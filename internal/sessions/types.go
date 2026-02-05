package sessions

import "time"

// SessionScope defines how sessions are scoped
type SessionScope string

const (
	// SessionScopePerSender creates a separate session for each sender (default)
	SessionScopePerSender SessionScope = "per-sender"
	// SessionScopeGlobal uses a single shared session for all users
	SessionScopeGlobal SessionScope = "global"
)

// SessionEntry represents a stored session with its state
type SessionEntry struct {
	// SessionID is the unique identifier for this session
	SessionID string `json:"sessionId"`
	// UpdatedAt is the timestamp when this session was last updated
	UpdatedAt int64 `json:"updatedAt"`
	// SessionFile is the path to the session transcript file (optional)
	SessionFile string `json:"sessionFile,omitempty"`

	// Delivery context for routing responses back
	DeliveryContext *DeliveryContext `json:"deliveryContext,omitempty"`
	// LastChannel is the last channel used for this session
	LastChannel string `json:"lastChannel,omitempty"`
	// LastTo is the last recipient for this session
	LastTo string `json:"lastTo,omitempty"`
	// LastAccountId is the last account ID for this session
	LastAccountId string `json:"lastAccountId,omitempty"`
	// LastThreadId is the last thread ID for this session
	LastThreadId string `json:"lastThreadId,omitempty"`

	// Webhook-specific fields
	WebhookMessageID string `json:"webhookMessageId,omitempty"`
	WebhookSessionID string `json:"webhookSessionId,omitempty"`

	// Session state
	SystemSent     bool `json:"systemSent,omitempty"`
	AbortedLastRun bool `json:"abortedLastRun,omitempty"`

	// Agent behavior settings
	ThinkingLevel  string `json:"thinkingLevel,omitempty"`
	VerboseLevel   string `json:"verboseLevel,omitempty"`
	ReasoningLevel string `json:"reasoningLevel,omitempty"`
	SendPolicy     string `json:"sendPolicy,omitempty"` // "allow" or "deny"

	// Model overrides
	ModelOverride    string `json:"modelOverride,omitempty"`
	ProviderOverride string `json:"providerOverride,omitempty"`
}

// DeliveryContext contains information needed to route responses
type DeliveryContext struct {
	Channel   string `json:"channel,omitempty"`
	To        string `json:"to,omitempty"`
	AccountId string `json:"accountId,omitempty"`
	ThreadId  string `json:"threadId,omitempty"`
}

// StoreConfig holds configuration for the session store
type StoreConfig struct {
	// StorePath is the path to the session store JSON file
	StorePath string
	// CacheTTL is how long to cache the store in memory
	CacheTTL time.Duration
	// LockTimeout is how long to wait for a lock
	LockTimeout time.Duration
}

// DefaultStoreConfig returns the default store configuration
func DefaultStoreConfig(storePath string) *StoreConfig {
	return &StoreConfig{
		StorePath:   storePath,
		CacheTTL:    45 * time.Second,
		LockTimeout: 10 * time.Second,
	}
}

// DefaultResetTriggers are the default command triggers that reset a session
var DefaultResetTriggers = []string{"/new", "/reset"}

// SessionResetPolicy defines when sessions are reset
type SessionResetPolicy string

const (
	// ResetPolicyNever never resets sessions automatically
	ResetPolicyNever SessionResetPolicy = "never"
	// ResetPolicyOnIdle resets sessions after idle timeout
	ResetPolicyOnIdle SessionResetPolicy = "idle"
	// ResetPolicyAlways resets on every message (for testing)
	ResetPolicyAlways SessionResetPolicy = "always"
)

// MergeSessionEntry merges a patch into an existing session entry
func MergeSessionEntry(existing *SessionEntry, patch *SessionEntry) *SessionEntry {
	if existing == nil {
		return patch
	}

	// Start with existing values
	result := &SessionEntry{}
	*result = *existing

	// Override with non-empty patch values
	if patch.SessionID != "" {
		result.SessionID = patch.SessionID
	}
	if patch.UpdatedAt > 0 {
		result.UpdatedAt = patch.UpdatedAt
	}
	if patch.SessionFile != "" {
		result.SessionFile = patch.SessionFile
	}
	if patch.DeliveryContext != nil {
		result.DeliveryContext = patch.DeliveryContext
	}
	if patch.LastChannel != "" {
		result.LastChannel = patch.LastChannel
	}
	if patch.LastTo != "" {
		result.LastTo = patch.LastTo
	}
	if patch.LastAccountId != "" {
		result.LastAccountId = patch.LastAccountId
	}
	if patch.LastThreadId != "" {
		result.LastThreadId = patch.LastThreadId
	}
	if patch.WebhookMessageID != "" {
		result.WebhookMessageID = patch.WebhookMessageID
	}
	if patch.WebhookSessionID != "" {
		result.WebhookSessionID = patch.WebhookSessionID
	}

	// Merge boolean flags (override if explicitly set)
	if patch.SystemSent {
		result.SystemSent = true
	}
	if patch.AbortedLastRun {
		result.AbortedLastRun = true
	}

	// Merge string fields
	if patch.ThinkingLevel != "" {
		result.ThinkingLevel = patch.ThinkingLevel
	}
	if patch.VerboseLevel != "" {
		result.VerboseLevel = patch.VerboseLevel
	}
	if patch.ReasoningLevel != "" {
		result.ReasoningLevel = patch.ReasoningLevel
	}
	if patch.SendPolicy != "" {
		result.SendPolicy = patch.SendPolicy
	}
	if patch.ModelOverride != "" {
		result.ModelOverride = patch.ModelOverride
	}
	if patch.ProviderOverride != "" {
		result.ProviderOverride = patch.ProviderOverride
	}

	return result
}
