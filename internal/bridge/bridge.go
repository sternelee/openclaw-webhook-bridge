package bridge

import (
	"encoding/json"
	"log"

	"github.com/sternelee/openclaw-webhook-bridge/internal/clawdbot"
	"github.com/sternelee/openclaw-webhook-bridge/internal/webhook"
)

// Bridge is a simple passthrough between Webhook and ClawdBot
type Bridge struct {
	webhookClient  *webhook.Client
	clawdbotClient *clawdbot.Client
}

// NewBridge creates a new bridge
func NewBridge(webhookClient *webhook.Client, clawdbotClient *clawdbot.Client) *Bridge {
	return &Bridge{
		webhookClient:  webhookClient,
		clawdbotClient: clawdbotClient,
	}
}

// SetWebhookClient sets the webhook client after construction
func (b *Bridge) SetWebhookClient(client *webhook.Client) {
	b.webhookClient = client
}

// HandleWebhookMessage handles a message from the webhook and forwards to ClawdBot
func (b *Bridge) HandleWebhookMessage(data []byte) error {
	log.Printf("[Bridge] Webhook -> ClawdBot: %s", string(data))

	// Parse the message to extract content and session
	var msg struct {
		ID      string `json:"id"`
		Content string `json:"content"`
		Session string `json:"session"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("[Bridge] Failed to parse webhook message: %v", err)
		// Send raw data anyway
		return b.clawdbotClient.SendRaw(data)
	}

	// Forward as agent request
	sessionKey := msg.Session
	if sessionKey == "" {
		sessionKey = "webhook:" + msg.ID
	}

	return b.clawdbotClient.SendAgentRequest(msg.Content, sessionKey)
}

// HandleClawdBotEvent handles an event from ClawdBot and forwards to webhook
func (b *Bridge) HandleClawdBotEvent(data []byte) {
	log.Printf("[Bridge] ClawdBot -> Webhook: %s", string(data))

	if err := b.webhookClient.Send(data); err != nil {
		log.Printf("[Bridge] Failed to send to webhook: %v", err)
	}
}
