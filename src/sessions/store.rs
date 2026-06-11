use anyhow::Result;
use fs2::FileExt;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use super::types::{
    current_timestamp, generate_session_id, DeliveryContext, SessionEntry, SessionStore,
};

/// Store configuration
#[derive(Debug, Clone)]
pub struct StoreConfig {
    pub store_path: PathBuf,
    pub cache_ttl: Duration,
}

impl StoreConfig {
    pub fn new(store_path: PathBuf) -> Self {
        Self {
            store_path,
            cache_ttl: Duration::from_secs(45),
        }
    }
}

/// Session store with file-based persistence
pub struct Store {
    config: StoreConfig,
    cache: Arc<Mutex<CacheEntry>>,
}

struct CacheEntry {
    data: SessionStore,
    loaded_at: Instant,
}

impl Store {
    pub fn new(config: StoreConfig) -> Self {
        Self {
            config,
            cache: Arc::new(Mutex::new(CacheEntry {
                data: HashMap::new(),
                loaded_at: Instant::now() - Duration::from_secs(100), // Force initial load
            })),
        }
    }

    /// Load the session store from disk
    pub fn load(&self) -> Result<SessionStore> {
        // Check cache first
        {
            let cache = self.cache.lock().unwrap();
            if cache.loaded_at.elapsed() < self.config.cache_ttl {
                return Ok(cache.data.clone());
            }
        }

        // Load from disk with file locking
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(true)
            .open(&self.config.store_path)?;

        file.lock_shared()?;

        let mut contents = String::new();
        let mut file_ref = &file;
        file_ref.read_to_string(&mut contents)?;

        let store: SessionStore = if contents.is_empty() {
            HashMap::new()
        } else {
            serde_json::from_str(&contents).unwrap_or_else(|_| HashMap::new())
        };

        file.unlock()?;

        // Update cache
        {
            let mut cache = self.cache.lock().unwrap();
            cache.data = store.clone();
            cache.loaded_at = Instant::now();
        }

        Ok(store)
    }

    /// Save the session store to disk
    fn save(&self, store: &SessionStore) -> Result<()> {
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(true)
            .open(&self.config.store_path)?;

        file.lock_exclusive()?;

        let contents = serde_json::to_string_pretty(store)?;
        let mut file_ref = &file;
        file_ref.write_all(contents.as_bytes())?;

        file.unlock()?;

        // Update cache
        {
            let mut cache = self.cache.lock().unwrap();
            cache.data = store.clone();
            cache.loaded_at = Instant::now();
        }

        Ok(())
    }

    /// Update store using a callback function
    pub fn update<F>(&self, f: F) -> Result<()>
    where
        F: FnOnce(&mut SessionStore) -> Result<()>,
    {
        let mut store = self.load()?;
        f(&mut store)?;
        self.save(&store)?;
        Ok(())
    }

    /// Get a session entry
    #[allow(dead_code)]
    pub fn get_entry(&self, key: &str) -> Result<Option<SessionEntry>> {
        let store = self.load()?;
        Ok(store.get(key).cloned())
    }

    /// Delete a session entry. Returns true if a row was removed.
    #[allow(dead_code)]
    pub fn delete_entry(&self, key: &str) -> Result<bool> {
        let mut removed = false;
        self.update(|store| {
            removed = store.remove(key).is_some();
            Ok(())
        })?;
        Ok(removed)
    }

    /// Find the (key, entry) pair whose session_id matches.
    /// Scans the full store; O(n). Used for `session.get` by id lookup.
    #[allow(dead_code)]
    pub fn find_by_session_id(&self, session_id: &str) -> Result<Option<(String, SessionEntry)>> {
        let store = self.load()?;
        Ok(store
            .iter()
            .find(|(_, v)| v.session_id == session_id)
            .map(|(k, v)| (k.clone(), v.clone())))
    }

    /// Update a session entry using a callback
    pub fn update_entry<F>(&self, key: &str, f: F) -> Result<SessionEntry>
    where
        F: FnOnce(Option<&SessionEntry>) -> Result<SessionEntry>,
    {
        let mut result = None;
        self.update(|store| {
            let existing = store.get(key);
            let entry = f(existing)?;
            store.insert(key.to_string(), entry.clone());
            result = Some(entry);
            Ok(())
        })?;
        Ok(result.unwrap())
    }

    /// Record inbound message metadata
    pub fn record_inbound_meta(
        &self,
        session_key: &str,
        message_id: &str,
        delivery_ctx: &DeliveryContext,
    ) -> Result<SessionEntry> {
        self.update_entry(session_key, |existing| {
            let mut entry = if let Some(e) = existing {
                e.clone()
            } else {
                SessionEntry {
                    session_id: generate_session_id(),
                    updated_at: current_timestamp(),
                    session_file: None,
                    delivery_context: None,
                    last_channel: None,
                    last_to: None,
                    last_account_id: None,
                    last_thread_id: None,
                    webhook_message_id: None,
                    webhook_session_id: None,
                }
            };

            // Update metadata
            entry.updated_at = current_timestamp();
            entry.delivery_context = Some(delivery_ctx.clone());
            entry.last_channel = delivery_ctx.channel.clone();
            entry.last_to = delivery_ctx.to.clone();
            entry.last_account_id = delivery_ctx.account_id.clone();
            entry.last_thread_id = delivery_ctx.thread_id.clone();
            entry.webhook_message_id = Some(message_id.to_string());

            Ok(entry)
        })
    }

    /// Update last route for a session
    #[allow(dead_code)]
    pub fn update_last_route(
        &self,
        session_key: &str,
        delivery_ctx: &DeliveryContext,
    ) -> Result<SessionEntry> {
        self.update_entry(session_key, |existing| {
            let mut entry = if let Some(e) = existing {
                e.clone()
            } else {
                SessionEntry {
                    session_id: generate_session_id(),
                    updated_at: current_timestamp(),
                    session_file: None,
                    delivery_context: None,
                    last_channel: None,
                    last_to: None,
                    last_account_id: None,
                    last_thread_id: None,
                    webhook_message_id: None,
                    webhook_session_id: None,
                }
            };

            // Update last route
            entry.updated_at = current_timestamp();
            if delivery_ctx.channel.is_some() {
                entry.last_channel = delivery_ctx.channel.clone();
            }
            if delivery_ctx.account_id.is_some() {
                entry.last_account_id = delivery_ctx.account_id.clone();
            }

            Ok(entry)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::path::PathBuf;

    fn temp_store(name: &str) -> Store {
        let mut path: PathBuf = env::temp_dir();
        path.push(format!(
            "openclaw-sessions-test-{}-{}.json",
            name,
            uuid::Uuid::new_v4()
        ));
        let _ = std::fs::remove_file(&path);
        Store::new(StoreConfig::new(path))
    }

    fn ctx(channel: &str, to: &str) -> DeliveryContext {
        DeliveryContext {
            channel: Some(channel.to_string()),
            to: Some(to.to_string()),
            account_id: Some("uid-test".to_string()),
            thread_id: None,
        }
    }

    #[test]
    fn record_and_get_entry_round_trips() {
        let store = temp_store("rt");
        let entry = store
            .record_inbound_meta("webhook:msg-1", "msg-1", &ctx("webhook", "msg-1"))
            .expect("record");
        let got = store.get_entry("webhook:msg-1").expect("get");
        assert_eq!(got.unwrap().session_id, entry.session_id);
    }

    #[test]
    fn delete_entry_returns_true_when_present() {
        let store = temp_store("del-yes");
        store
            .record_inbound_meta("k1", "m1", &ctx("webhook", "m1"))
            .unwrap();
        assert!(store.delete_entry("k1").unwrap());
        assert!(store.get_entry("k1").unwrap().is_none());
    }

    #[test]
    fn delete_entry_returns_false_when_absent() {
        let store = temp_store("del-no");
        assert!(!store.delete_entry("nope").unwrap());
    }

    #[test]
    fn find_by_session_id_returns_owner_key() {
        let store = temp_store("find");
        store
            .record_inbound_meta("webhook:a", "a", &ctx("webhook", "a"))
            .unwrap();
        let entry = store
            .record_inbound_meta("webhook:b", "b", &ctx("webhook", "b"))
            .unwrap();
        let (key, found) = store
            .find_by_session_id(&entry.session_id)
            .unwrap()
            .unwrap();
        assert_eq!(key, "webhook:b");
        assert_eq!(found.session_id, entry.session_id);
    }

    #[test]
    fn find_by_session_id_returns_none_when_missing() {
        let store = temp_store("find-miss");
        assert!(store.find_by_session_id("nope").unwrap().is_none());
    }
}
