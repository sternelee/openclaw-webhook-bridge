use anyhow::Result;
use fs2::FileExt;
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use super::types::{current_timestamp, generate_session_id, DeliveryContext, SessionEntry, SessionStore};

/// Store configuration
#[derive(Debug, Clone)]
pub struct StoreConfig {
    pub store_path: PathBuf,
    pub cache_ttl: Duration,
    pub lock_timeout: Duration,
}

impl StoreConfig {
    pub fn new(store_path: PathBuf) -> Self {
        Self {
            store_path,
            cache_ttl: Duration::from_secs(45),
            lock_timeout: Duration::from_secs(10),
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
    pub fn get_entry(&self, key: &str) -> Result<Option<SessionEntry>> {
        let store = self.load()?;
        Ok(store.get(key).cloned())
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
