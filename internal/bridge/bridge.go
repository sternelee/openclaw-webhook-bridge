package bridge

import (
	"encoding/json"
	"log"

	"github.com/sternelee/openclaw-webhook-bridge/internal/openclaw"
	"github.com/sternelee/openclaw-webhook-bridge/internal/webhook"
)

// Bridge is a simple passthrough between Webhook and OpenClaw
type Bridge struct {
	webhookClient  *webhook.Client
	clawdbotClient *openclaw.Client
	uid           string // Unique ID for this bridge instance
}

// NewBridge creates a new bridge
func NewBridge(webhookClient *webhook.Client, clawdbotClient *openclaw.Client) *Bridge {
	return &Bridge{
		webhookClient:  webhookClient,
		clawdbotClient: clawdbotClient,
	}
}

// SetWebhookClient sets the webhook client after construction
func (b *Bridge) SetWebhookClient(client *webhook.Client) {
	b.webhookClient = client
}

// SetUID sets the unique ID for this bridge
func (b *Bridge) SetUID(uid string) {
	b.uid = uid
	log.Printf("[Bridge] Bridge UID set to: %s", b.uid)
}

// HandleWebhookMessage handles a message from the webhook and forwards to OpenClaw
func (b *Bridge) HandleWebhookMessage(data []byte) error {
	log.Printf("[Bridge] Webhook -> OpenClaw: %s", string(data))

	// Check if this is a control message (not a user message)
	var controlMsg struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &controlMsg); err == nil {
		// Skip control messages like "connected", "error", etc.
		if controlMsg.Type == "connected" || controlMsg.Type == "error" || controlMsg.Type == "event" {
			log.Printf("[Bridge] Skipping control message: type=%s", controlMsg.Type)
			return nil
		}
	}

	// Parse the message to extract content and session
	var msg struct {
		ID      string `json:"id"`
		Content string `json:"content"`
		Session string `json:"session"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("[Bridge] Failed to parse webhook message: %v", err)
		// Skip unparseable messages
		return nil
	}

	// Skip empty messages
	if msg.Content == "" {
		log.Printf("[Bridge] Skipping empty message")
		return nil
	}

	// Forward as agent request
	sessionKey := msg.Session
	if sessionKey == "" {
		sessionKey = "webhook:" + msg.ID
	}

	return b.clawdbotClient.SendAgentRequest(msg.Content, sessionKey)
}

// HandleOpenClawEvent handles an event from OpenClaw and forwards to webhook
func (b *Bridge) HandleOpenClawEvent(data []byte) {
	log.Printf("[Bridge] OpenClaw -> Webhook: %s", string(data))

	if err := b.webhookClient.Send(data); err != nil {
		log.Printf("[Bridge] Failed to send to webhook: %v", err)
	}
}
