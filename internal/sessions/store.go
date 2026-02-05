package sessions

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Store manages session persistence with in-memory caching and file locking
type Store struct {
	config      *StoreConfig
	cache       *StoreCache
	cacheMu     sync.RWMutex
	lockDir     string
	enableCache bool
}

// StoreCache holds cached session data
type StoreCache struct {
	store     map[string]*SessionEntry
	loadedAt  time.Time
	mtimeMs   int64
	validOnce bool
}

// NewStore creates a new session store
func NewStore(config *StoreConfig) *Store {
	if config == nil {
		panic("config cannot be nil")
	}

	// Ensure store directory exists
	storeDir := filepath.Dir(config.StorePath)
	if err := os.MkdirAll(storeDir, 0755); err != nil {
		log.Printf("[SessionStore] Failed to create store directory: %v", err)
	}

	// Lock directory in the same location as the store
	lockDir := storeDir

	return &Store{
		config:      config,
		lockDir:     lockDir,
		enableCache: config.CacheTTL > 0,
	}
}

// Load loads the session store from disk (with cache support)
func (s *Store) Load() (map[string]*SessionEntry, error) {
	// Check cache first
	if s.enableCache {
		s.cacheMu.RLock()
		if s.cache != nil && s.isCacheValid(s.cache) {
			// Check if file hasn't been modified
			if s.getFileMtimeMs() == s.cache.mtimeMs {
				// Return a copy to prevent external mutations
				result := s.copyStore(s.cache.store)
				s.cacheMu.RUnlock()
				log.Printf("[SessionStore] Loaded from cache (%d sessions)", len(result))
				return result, nil
			}
		}
		s.cacheMu.RUnlock()
	}

	// Load from disk
	store := make(map[string]*SessionEntry)
	data, err := os.ReadFile(s.config.StorePath)
	if err != nil {
		if os.IsNotExist(err) {
			// First run - return empty store
			log.Printf("[SessionStore] No existing store, starting fresh")
			return store, nil
		}
		return nil, fmt.Errorf("failed to read store: %w", err)
	}

	if err := json.Unmarshal(data, &store); err != nil {
		log.Printf("[SessionStore] Failed to parse store, starting fresh: %v", err)
		return make(map[string]*SessionEntry), nil
	}

	// Update cache
	if s.enableCache {
		s.cacheMu.Lock()
		s.cache = &StoreCache{
			store:    s.copyStore(store),
			loadedAt: time.Now(),
			mtimeMs:  s.getFileMtimeMs(),
		}
		s.cacheMu.Unlock()
	}

	log.Printf("[SessionStore] Loaded from disk (%d sessions)", len(store))
	return store, nil
}

// Save saves the session store to disk (with locking)
func (s *Store) Save(store map[string]*SessionEntry) error {
	return s.withLock(func() error {
		return s.saveUnlocked(store)
	})
}

// Update atomically updates the session store
func (s *Store) Update(mutator func(map[string]*SessionEntry) error) error {
	return s.withLock(func() error {
		// Always re-read inside the lock to avoid clobbering concurrent writers
		store, err := s.loadUnlocked()
		if err != nil {
			return err
		}

		if err := mutator(store); err != nil {
			return err
		}

		return s.saveUnlocked(store)
	})
}

// GetEntry retrieves a single session entry
func (s *Store) GetEntry(sessionKey string) (*SessionEntry, error) {
	store, err := s.Load()
	if err != nil {
		return nil, err
	}
	return store[sessionKey], nil
}

// UpdateEntry updates a single session entry
func (s *Store) UpdateEntry(sessionKey string, update func(*SessionEntry) (*SessionEntry, error)) (*SessionEntry, error) {
	var result *SessionEntry
	err := s.Update(func(store map[string]*SessionEntry) error {
		existing := store[sessionKey]
		patch, err := update(existing)
		if err != nil {
			return err
		}
		if patch == nil {
			result = existing
			return nil
		}

		// Merge patch into existing
		merged := MergeSessionEntry(existing, patch)
		store[sessionKey] = merged
		result = merged
		return nil
	})
	return result, err
}

// RecordInboundMeta records session metadata from an incoming webhook message
func (s *Store) RecordInboundMeta(sessionKey string, webhookMsgID string, deliveryCtx *DeliveryContext) (*SessionEntry, error) {
	return s.UpdateEntry(sessionKey, func(existing *SessionEntry) (*SessionEntry, error) {
		now := time.Now().UnixMilli()

		if existing != nil {
			// Update existing entry
			return &SessionEntry{
				SessionID:        existing.SessionID,
				UpdatedAt:        now,
				SessionFile:      existing.SessionFile,
				DeliveryContext:  deliveryCtx,
				LastChannel:      deliveryChannel(deliveryCtx),
				LastTo:           deliveryTo(deliveryCtx),
				LastAccountId:    deliveryAccountId(deliveryCtx),
				LastThreadId:     deliveryThreadId(deliveryCtx),
				WebhookMessageID: webhookMsgID,
				WebhookSessionID: sessionKey,
				// Preserve existing state
				SystemSent:       existing.SystemSent,
				AbortedLastRun:   existing.AbortedLastRun,
				ThinkingLevel:    existing.ThinkingLevel,
				VerboseLevel:     existing.VerboseLevel,
				ReasoningLevel:   existing.ReasoningLevel,
				SendPolicy:       existing.SendPolicy,
				ModelOverride:    existing.ModelOverride,
				ProviderOverride: existing.ProviderOverride,
			}, nil
		}

		// Create new entry - minimal state for webhook sessions
		return &SessionEntry{
			SessionID:        generateSessionID(),
			UpdatedAt:        now,
			DeliveryContext:  deliveryCtx,
			LastChannel:      deliveryChannel(deliveryCtx),
			LastTo:           deliveryTo(deliveryCtx),
			LastAccountId:    deliveryAccountId(deliveryCtx),
			LastThreadId:     deliveryThreadId(deliveryCtx),
			WebhookMessageID: webhookMsgID,
			WebhookSessionID: sessionKey,
		}, nil
	})
}

// UpdateLastRoute updates the last delivery route for a session
func (s *Store) UpdateLastRoute(sessionKey string, deliveryCtx *DeliveryContext) (*SessionEntry, error) {
	return s.UpdateEntry(sessionKey, func(existing *SessionEntry) (*SessionEntry, error) {
		patch := &SessionEntry{
			UpdatedAt:       time.Now().UnixMilli(),
			DeliveryContext: deliveryCtx,
			LastChannel:     deliveryChannel(deliveryCtx),
			LastTo:          deliveryTo(deliveryCtx),
			LastAccountId:   deliveryAccountId(deliveryCtx),
			LastThreadId:    deliveryThreadId(deliveryCtx),
		}
		return patch, nil
	})
}

// loadUnlocked loads without cache checks (must be called with lock held)
func (s *Store) loadUnlocked() (map[string]*SessionEntry, error) {
	store := make(map[string]*SessionEntry)
	data, err := os.ReadFile(s.config.StorePath)
	if err != nil {
		if os.IsNotExist(err) {
			return store, nil
		}
		return nil, fmt.Errorf("failed to read store: %w", err)
	}

	if err := json.Unmarshal(data, &store); err != nil {
		log.Printf("[SessionStore] Failed to parse store: %v", err)
		return make(map[string]*SessionEntry), nil
	}

	return store, nil
}

// saveUnlocked saves without locking (must be called with lock held)
func (s *Store) saveUnlocked(store map[string]*SessionEntry) error {
	// Invalidate cache on write
	s.cacheMu.Lock()
	s.cache = nil
	s.cacheMu.Unlock()

	// Serialize
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal store: %w", err)
	}

	// Write atomically using temp file
	tmpPath := s.config.StorePath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}

	// Rename atomically
	if err := os.Rename(tmpPath, s.config.StorePath); err != nil {
		os.Remove(tmpPath) // Clean up temp file
		return fmt.Errorf("failed to rename store file: %w", err)
	}

	log.Printf("[SessionStore] Saved %d sessions", len(store))
	return nil
}

// isCacheValid checks if a cache entry is still valid
func (s *Store) isCacheValid(cache *StoreCache) bool {
	if cache == nil {
		return false
	}
	return time.Since(cache.loadedAt) < s.config.CacheTTL
}

// copyStore creates a deep copy of the session store
func (s *Store) copyStore(store map[string]*SessionEntry) map[string]*SessionEntry {
	result := make(map[string]*SessionEntry, len(store))
	for k, v := range store {
		if v != nil {
			copy := *v
			result[k] = &copy
		}
	}
	return result
}

// getFileMtimeMs gets the file modification time in milliseconds
func (s *Store) getFileMtimeMs() int64 {
	info, err := os.Stat(s.config.StorePath)
	if err != nil {
		return 0
	}
	return info.ModTime().UnixMilli()
}

// withLock executes a function with the store lock held
func (s *Store) withLock(fn func() error) error {
	lockPath := s.config.StorePath + ".lock"
	startedAt := time.Now()
	timeout := s.config.LockTimeout
	pollInterval := 25 * time.Millisecond
	staleDuration := 30 * time.Second

	// Ensure lock directory exists
	if err := os.MkdirAll(s.lockDir, 0755); err != nil {
		return fmt.Errorf("failed to create lock directory: %w", err)
	}

	// Acquire lock
	for {
		// Try to create lock file exclusively
		f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if err == nil {
			// Lock acquired
			lockInfo := map[string]interface{}{
				"pid":       os.Getpid(),
				"startedAt": time.Now().Unix(),
			}
			data, _ := json.Marshal(lockInfo)
			f.Write(data)
			f.Close()
			break
		}

		if !os.IsExist(err) {
			return fmt.Errorf("unexpected lock error: %w", err)
		}

		// Check timeout
		if time.Since(startedAt) > timeout {
			return fmt.Errorf("timeout acquiring lock: %s", lockPath)
		}

		// Check for stale lock and try to clean it up
		if info, err := os.Stat(lockPath); err == nil {
			age := time.Since(info.ModTime())
			if age > staleDuration {
				log.Printf("[SessionStore] Removing stale lock (%v old)", age)
				os.Remove(lockPath)
				continue
			}
		}

		// Wait before retrying
		time.Sleep(pollInterval)
	}

	// Execute function with cleanup
	defer func() {
		os.Remove(lockPath) // Best-effort cleanup
	}()

	return fn()
}

// Helper functions for delivery context
func deliveryChannel(ctx *DeliveryContext) string {
	if ctx != nil {
		return ctx.Channel
	}
	return ""
}

func deliveryTo(ctx *DeliveryContext) string {
	if ctx != nil {
		return ctx.To
	}
	return ""
}

func deliveryAccountId(ctx *DeliveryContext) string {
	if ctx != nil {
		return ctx.AccountId
	}
	return ""
}

func deliveryThreadId(ctx *DeliveryContext) string {
	if ctx != nil {
		return ctx.ThreadId
	}
	return ""
}

// generateSessionID generates a unique session ID
// Using timestamp-based ID for simplicity (can be replaced with UUID)
func generateSessionID() string {
	return fmt.Sprintf("sess_%d", time.Now().UnixNano())
}

// GenerateSessionID generates a unique session ID (exported version)
func GenerateSessionID() string {
	return generateSessionID()
}
