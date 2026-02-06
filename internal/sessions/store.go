package sessions

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gofrs/flock"
)

// Store manages session persistence with in-memory caching and file locking
type Store struct {
	config      *StoreConfig
	cache       *StoreCache
	cacheMu     sync.RWMutex
	lockDir     string
	enableCache bool

	// Cached file mtime with periodic refresh
	mtimeCache    int64
	mtimeCacheMu  sync.RWMutex
	mtimeCacheExp time.Time
}

// StoreCache holds cached session data
type StoreCache struct {
	store     map[string]*SessionEntry
	loadedAt  time.Time
	mtimeMs   int64
	validOnce bool
}

// ReadonlyStore provides a read-only view of the session store
type ReadonlyStore struct {
	store map[string]*SessionEntry
	mu    sync.RWMutex
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
// Returns a ReadonlyStore for efficient read-only access
func (s *Store) Load() (map[string]*SessionEntry, error) {
	// Check cache first
	if s.enableCache {
		s.cacheMu.RLock()
		if s.cache != nil && s.isCacheValid(s.cache) {
			// Check if file hasn't been modified (using cached mtime)
			if s.getFileMtimeMsCached() == s.cache.mtimeMs {
				// Return a copy for backward compatibility
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
			mtimeMs:  s.getFileMtimeMsCached(),
		}
		s.cacheMu.Unlock()
	}

	log.Printf("[SessionStore] Loaded from disk (%d sessions)", len(store))
	return store, nil
}

// LoadReadonly loads the session store and returns a read-only view
// This is more efficient than Load() for read-heavy workloads
func (s *Store) LoadReadonly() (*ReadonlyStore, error) {
	store, err := s.Load()
	if err != nil {
		return nil, err
	}
	return &ReadonlyStore{store: store}, nil
}

// Get returns a session entry by key from the readonly store
func (r *ReadonlyStore) Get(key string) *SessionEntry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.store[key]
}

// Has checks if a session exists
func (r *ReadonlyStore) Has(key string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.store[key]
	return ok
}

// Count returns the number of sessions
func (r *ReadonlyStore) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.store)
}

// All returns a copy of all sessions
func (r *ReadonlyStore) All() map[string]*SessionEntry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make(map[string]*SessionEntry, len(r.store))
	for k, v := range r.store {
		if v != nil {
			copy := *v
			result[k] = &copy
		}
	}
	return result
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
	// Invalidate cache and mtime cache on write
	s.cacheMu.Lock()
	s.cache = nil
	s.cacheMu.Unlock()

	s.mtimeCacheMu.Lock()
	s.mtimeCache = 0
	s.mtimeCacheExp = time.Time{}
	s.mtimeCacheMu.Unlock()

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

// copyStore creates a shallow copy of the session store map
// Individual SessionEntry values are copied by value (not deep cloned)
// This is safe because SessionEntry contains only primitive types and pointers
// that are never mutated after being stored
func (s *Store) copyStore(store map[string]*SessionEntry) map[string]*SessionEntry {
	result := make(map[string]*SessionEntry, len(store))
	for k, v := range store {
		if v != nil {
			// Shallow copy - copy the struct but not nested pointers
			// Since DeliveryContext is the only nested pointer and we don't mutate it,
			// this is safe for read-only access
			copy := *v
			result[k] = &copy
		}
	}
	return result
}

// getFileMtimeMsCached gets the file modification time with caching
// Cache expires after 1 second to reduce syscalls while staying fresh
func (s *Store) getFileMtimeMsCached() int64 {
	s.mtimeCacheMu.RLock()
	if time.Now().Before(s.mtimeCacheExp) && s.mtimeCache > 0 {
		mtime := s.mtimeCache
		s.mtimeCacheMu.RUnlock()
		return mtime
	}
	s.mtimeCacheMu.RUnlock()

	// Cache miss or expired, get fresh value
	mtime := s.getFileMtimeMs()

	s.mtimeCacheMu.Lock()
	s.mtimeCache = mtime
	s.mtimeCacheExp = time.Now().Add(time.Second)
	s.mtimeCacheMu.Unlock()

	return mtime
}

// getFileMtimeMs gets the file modification time in milliseconds
func (s *Store) getFileMtimeMs() int64 {
	info, err := os.Stat(s.config.StorePath)
	if err != nil {
		return 0
	}
	return info.ModTime().UnixMilli()
}

// withLock executes a function with the store lock held using flock
func (s *Store) withLock(fn func() error) error {
	lockPath := s.config.StorePath + ".lock"
	timeout := s.config.LockTimeout

	// Ensure lock directory exists
	if err := os.MkdirAll(s.lockDir, 0755); err != nil {
		return fmt.Errorf("failed to create lock directory: %w", err)
	}

	// Use flock for proper file locking
	fileLock := flock.New(lockPath)

	// Try to get lock with timeout using exponential backoff
	startedAt := time.Now()
	pollInterval := 25 * time.Millisecond
	staleDuration := 30 * time.Second

	for {
		locked, err := fileLock.TryLock()
		if err != nil {
			return fmt.Errorf("lock error: %w", err)
		}
		if locked {
			defer fileLock.Unlock()
			// Check for stale lock info and log
			if info, err := os.Stat(lockPath); err == nil {
				age := time.Since(info.ModTime())
				if age > staleDuration {
					log.Printf("[SessionStore] Warning: lock file is %v old (may indicate crashed process)", age)
				}
			}
			return fn()
		}

		// Check timeout
		if time.Since(startedAt) > timeout {
			return fmt.Errorf("timeout acquiring lock: %s", lockPath)
		}

		// Wait before retrying
		time.Sleep(pollInterval)
	}
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
