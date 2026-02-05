package bridge

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/sternelee/openclaw-webhook-bridge/internal/commands"
	"github.com/sternelee/openclaw-webhook-bridge/internal/openclaw"
	"github.com/sternelee/openclaw-webhook-bridge/internal/sessions"
	"github.com/sternelee/openclaw-webhook-bridge/internal/webhook"
)

// Bridge is a simple passthrough between Webhook and OpenClaw with session management
type Bridge struct {
	webhookClient  *webhook.Client
	clawdbotClient *openclaw.Client
	commandHandler *commands.CommandHandler
	agentID        string
	uid            string // Unique ID for this bridge instance
	sessionStore   *sessions.Store
	sessionScope   sessions.SessionScope
}

// NewBridge creates a new bridge
func NewBridge(webhookClient *webhook.Client, clawdbotClient *openclaw.Client) *Bridge {
	agentID := ""
	if clawdbotClient != nil {
		agentID = clawdbotClient.AgentID()
	}
	// Create command handler with openclaw client as gateway client
	cmdHandler := commands.NewCommandHandler(clawdbotClient)
	return &Bridge{
		webhookClient:  webhookClient,
		clawdbotClient: clawdbotClient,
		commandHandler: cmdHandler,
		agentID:        agentID,
		sessionScope:   sessions.SessionScopePerSender, // Default
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

// SetSessionStore configures the session store
func (b *Bridge) SetSessionStore(store *sessions.Store) {
	b.sessionStore = store
	log.Printf("[Bridge] Session store configured")
}

// SetSessionScope sets the session scope
func (b *Bridge) SetSessionScope(scope sessions.SessionScope) {
	b.sessionScope = scope
	log.Printf("[Bridge] Session scope set to: %s", scope)
}

// HandleWebhookMessage handles a message from the webhook and forwards to OpenClaw
func (b *Bridge) HandleWebhookMessage(data []byte) error {
	log.Printf("[Bridge] Webhook -> OpenClaw: %s", string(data))

	// Check for session control messages first
	if sessions.IsSessionControlMessage(data) {
		return b.handleSessionControlMessage(data)
	}

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
		ID       string `json:"id"`
		Content  string `json:"content"`
		Session  string `json:"session"`
		PeerKind string `json:"peerKind"`
		PeerID   string `json:"peerId"`
		ChatType string `json:"chatType"`
		ChatID   string `json:"chatId"`
		SenderID string `json:"senderId"`
		TopicID  string `json:"topicId"`
		ThreadID string `json:"threadId"`
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

	// Check if this is a command (starts with /)
	if commands.IsCommand(msg.Content) {
		return b.handleCommand(msg.Content, msg.Session, msg.ID)
	}

	// Resolve session key using session scope
	webhookMsg := &sessions.WebhookMessage{
		ID:      msg.ID,
		Content: msg.Content,
		Session: msg.Session,
	}
	sessionKey := ""
	peerKind := strings.TrimSpace(msg.PeerKind)
	if peerKind == "" {
		peerKind = strings.TrimSpace(msg.ChatType)
	}
	peerID := strings.TrimSpace(msg.PeerID)
	if peerID == "" {
		peerID = strings.TrimSpace(msg.ChatID)
	}
	if peerID == "" {
		peerID = strings.TrimSpace(msg.SenderID)
	}
	if peerKind == "" && peerID != "" {
		peerKind = "dm"
	}

	topicID := strings.TrimSpace(msg.TopicID)
	threadID := strings.TrimSpace(msg.ThreadID)

	if msg.Session != "" {
		sessionKey = sessions.NormalizeSessionKey(msg.Session)
	} else if peerKind != "" && peerID != "" {
		if resolved, ok := sessions.BuildWebhookSessionKey(sessions.WebhookSessionParams{
			AgentID:  b.agentID,
			PeerKind: peerKind,
			PeerID:   peerID,
			TopicID:  topicID,
			ThreadID: threadID,
		}); ok {
			sessionKey = resolved
		}
	}
	if sessionKey == "" {
		sessionKey = sessions.ResolveSessionKey(b.sessionScope, webhookMsg)
	}

	log.Printf("[Bridge] Resolved session key: %s (scope: %s)", sessionKey, b.sessionScope)

	// Check for reset triggers before creating new session
	resetTriggered := b.isResetTrigger(msg.Content)
	if resetTriggered {
		log.Printf("[Bridge] Reset trigger detected, will create new session")
		// Strip reset command from content
		strippedContent := b.stripResetTrigger(msg.Content)
		msg.Content = strippedContent
	}

	// Record session metadata if session store is configured
	if b.sessionStore != nil {
		deliveryTo := msg.ID
		if peerID != "" {
			deliveryTo = peerID
		}
		deliveryThreadID := ""
		if peerKind == "dm" {
			deliveryThreadID = threadID
		} else if peerKind == "group" || peerKind == "channel" {
			if topicID != "" {
				deliveryThreadID = topicID
			} else if threadID != "" {
				deliveryThreadID = threadID
			}
		}
		deliveryCtx := &sessions.DeliveryContext{
			Channel:   "webhook",
			To:        deliveryTo,
			AccountId: b.uid,
			ThreadId:  deliveryThreadID,
		}

		// If reset was triggered, we need to reset the session first
		if resetTriggered {
			_, err := b.sessionStore.UpdateEntry(sessionKey, func(existing *sessions.SessionEntry) (*sessions.SessionEntry, error) {
				return &sessions.SessionEntry{
					SessionID: sessions.GenerateSessionID(),
					UpdatedAt: getCurrentTimestamp(),
				}, nil
			})
			if err != nil {
				log.Printf("[Bridge] Failed to reset session: %v", err)
			} else {
				log.Printf("[Bridge] Session reset successfully")
			}
		}

		entry, err := b.sessionStore.RecordInboundMeta(sessionKey, msg.ID, deliveryCtx)
		if err != nil {
			log.Printf("[Bridge] Failed to record session metadata: %v", err)
		} else {
			log.Printf("[Bridge] Session metadata recorded: sessionId=%s",
				entry.SessionID)
		}
	}

	// Forward as agent request
	return b.clawdbotClient.SendAgentRequest(msg.Content, sessionKey)
}

// HandleOpenClawEvent handles an event from OpenClaw and forwards to webhook
func (b *Bridge) HandleOpenClawEvent(data []byte) {
	log.Printf("[Bridge] OpenClaw -> Webhook: %s", string(data))

	// Parse the event to determine its type
	var baseEvent struct {
		Type  string `json:"type,omitempty"`
		Event string `json:"event,omitempty"` // For lifecycle events
	}
	if err := json.Unmarshal(data, &baseEvent); err != nil {
		log.Printf("[Bridge] Failed to parse event type: %v", err)
		// Send raw data anyway
		b.sendToWebhook(data)
		return
	}

	// Check if this is a lifecycle event that needs special handling
	if baseEvent.Event == "lifecycle" || baseEvent.Event == "tick" || baseEvent.Event == "presence" || baseEvent.Event == "health" {
		// Skip internal lifecycle events
		return
	}

	// Extract session key from event for route tracking
	var sessionEvent struct {
		SessionKey string `json:"sessionKey,omitempty"`
	}
	if err := json.Unmarshal(data, &sessionEvent); err == nil && sessionEvent.SessionKey != "" && b.sessionStore != nil {
		// Update last route for this session
		_, err := b.sessionStore.UpdateLastRoute(sessionEvent.SessionKey, &sessions.DeliveryContext{
			Channel:   "webhook",
			AccountId: b.uid,
		})
		if err != nil {
			log.Printf("[Bridge] Failed to update last route: %v", err)
		}
	}

	// Convert OpenClaw event format to webhook format
	convertedData := b.convertEventToWebhookFormat(data, baseEvent.Type)
	b.sendToWebhook(convertedData)
}

// sendToWebhook sends data to the webhook client
func (b *Bridge) sendToWebhook(data []byte) {
	if err := b.webhookClient.Send(data); err != nil {
		log.Printf("[Bridge] Failed to send to webhook: %v", err)
	}
}

// convertEventToWebhookFormat converts OpenClaw event format to webhook format
func (b *Bridge) convertEventToWebhookFormat(data []byte, eventType string) []byte {
	// Handle "agent" events from OpenClaw Gateway
	if eventType == "agent" {
		var agentEvent struct {
			Stream     string `json:"stream,omitempty"`
			SessionKey string `json:"sessionKey,omitempty"`
			Data       struct {
				Text  string `json:"text,omitempty"`
				Phase string `json:"phase,omitempty"`
			} `json:"data,omitempty"`
		}
		if err := json.Unmarshal(data, &agentEvent); err == nil {
			// Check for lifecycle events
			if agentEvent.Stream == "lifecycle" {
				// "end" phase means the request is complete
				if agentEvent.Data.Phase == "end" || agentEvent.Data.Phase == "complete" {
					// Send empty complete event to signal end
					response := map[string]interface{}{
						"type":    "complete",
						"content": "",
						"session": agentEvent.SessionKey,
					}
					converted, _ := json.Marshal(response)
					return converted
				}
				// Skip other lifecycle phases
				return nil
			}
			// "assistant" stream with text content
			if agentEvent.Stream == "assistant" && agentEvent.Data.Text != "" {
				response := map[string]interface{}{
					"type":    "progress",
					"content": agentEvent.Data.Text,
					"session": agentEvent.SessionKey,
				}
				converted, _ := json.Marshal(response)
				return converted
			}
			// "tool" stream - skip for cleaner output
			if agentEvent.Stream == "tool" {
				return nil
			}
		}
	}

	// Handle "chat" events from OpenClaw Gateway
	if eventType == "chat" {
		var chatEvent struct {
			State      string `json:"state,omitempty"`
			SessionKey string `json:"sessionKey,omitempty"`
			Message    *struct {
				Content []struct {
					Type string `json:"type,omitempty"`
					Text string `json:"text,omitempty"`
				} `json:"content,omitempty"`
			} `json:"message,omitempty"`
		}
		if err := json.Unmarshal(data, &chatEvent); err == nil {
			// Extract text from content array
			var text string
			if chatEvent.Message != nil && len(chatEvent.Message.Content) > 0 {
				for _, c := range chatEvent.Message.Content {
					if c.Type == "text" {
						text += c.Text
					}
				}
			}
			// "final" state means complete
			if chatEvent.State == "final" {
				response := map[string]interface{}{
					"type":    "complete",
					"content": text,
					"session": chatEvent.SessionKey,
				}
				converted, _ := json.Marshal(response)
				return converted
			}
			// "delta" state means progress (streaming)
			if chatEvent.State == "delta" && text != "" {
				response := map[string]interface{}{
					"type":    "progress",
					"content": text,
					"session": chatEvent.SessionKey,
				}
				converted, _ := json.Marshal(response)
				return converted
			}
			// "error" state
			if chatEvent.State == "error" {
				response := map[string]interface{}{
					"type":    "error",
					"content": "An error occurred",
					"session": chatEvent.SessionKey,
				}
				converted, _ := json.Marshal(response)
				return converted
			}
		}
	}

	// For unknown event types, return original data
	return data
}

// handleSessionControlMessage handles session control messages
func (b *Bridge) handleSessionControlMessage(data []byte) error {
	if b.sessionStore == nil {
		log.Printf("[Bridge] Session store not configured, ignoring control message")
		return nil
	}

	ctrlMsg, err := sessions.ParseSessionControlMessage(data)
	if err != nil {
		log.Printf("[Bridge] Failed to parse session control message: %v", err)
		return err
	}

	log.Printf("[Bridge] Handling session control: type=%s, key=%s", ctrlMsg.Type, ctrlMsg.Key)

	switch ctrlMsg.Type {
	case sessions.ControlMessageSessionGet:
		return b.handleSessionGet(ctrlMsg)
	case sessions.ControlMessageSessionList:
		return b.handleSessionList()
	case sessions.ControlMessageSessionReset:
		return b.handleSessionReset(ctrlMsg)
	case sessions.ControlMessageSessionDelete:
		return b.handleSessionDelete(ctrlMsg)
	default:
		log.Printf("[Bridge] Unknown control message type: %s", ctrlMsg.Type)
	}

	return nil
}

// handleSessionGet returns information about a specific session
func (b *Bridge) handleSessionGet(msg *sessions.SessionControlMessage) error {
	sessionKey := msg.Key
	if sessionKey == "" {
		sessionKey = msg.ID
	}

	entry, err := b.sessionStore.GetEntry(sessionKey)
	if err != nil {
		return b.sendControlResponse(msg.Type, map[string]interface{}{
			"error": "Session not found",
		})
	}

	response := sessions.SessionInfoResponse{
		Key:             sessionKey,
		SessionID:       entry.SessionID,
		UpdatedAt:       entry.UpdatedAt,
		DeliveryContext: entry.DeliveryContext,
		LastChannel:     entry.LastChannel,
		LastTo:          entry.LastTo,
	}

	return b.sendControlResponse(msg.Type, response)
}

// handleSessionList returns all sessions
func (b *Bridge) handleSessionList() error {
	store, err := b.sessionStore.Load()
	if err != nil {
		return err
	}

	sessionList := make([]sessions.SessionInfoResponse, 0, len(store))
	for key, entry := range store {
		if entry != nil {
			sessionList = append(sessionList, sessions.SessionInfoResponse{
				Key:             key,
				SessionID:       entry.SessionID,
				UpdatedAt:       entry.UpdatedAt,
				DeliveryContext: entry.DeliveryContext,
				LastChannel:     entry.LastChannel,
				LastTo:          entry.LastTo,
			})
		}
	}

	response := sessions.SessionListResponse{
		Sessions: sessionList,
		Count:    len(sessionList),
	}

	return b.sendControlResponse(sessions.ControlMessageSessionList, response)
}

// handleSessionReset resets a session
func (b *Bridge) handleSessionReset(msg *sessions.SessionControlMessage) error {
	sessionKey := msg.Key
	if sessionKey == "" {
		sessionKey = msg.ID
	}

	_, err := b.sessionStore.UpdateEntry(sessionKey, func(existing *sessions.SessionEntry) (*sessions.SessionEntry, error) {
		return &sessions.SessionEntry{
			SessionID: sessions.GenerateSessionID(),
			UpdatedAt: getCurrentTimestamp(),
		}, nil
	})

	if err != nil {
		return b.sendControlResponse(msg.Type, map[string]interface{}{
			"error": "Failed to reset session",
		})
	}

	return b.sendControlResponse(msg.Type, map[string]interface{}{
		"success": true,
		"key":     sessionKey,
	})
}

// handleSessionDelete deletes a session
func (b *Bridge) handleSessionDelete(msg *sessions.SessionControlMessage) error {
	sessionKey := msg.Key
	if sessionKey == "" {
		sessionKey = msg.ID
	}

	err := b.sessionStore.Update(func(store map[string]*sessions.SessionEntry) error {
		delete(store, sessionKey)
		return nil
	})

	if err != nil {
		return b.sendControlResponse(msg.Type, map[string]interface{}{
			"error": "Failed to delete session",
		})
	}

	return b.sendControlResponse(msg.Type, map[string]interface{}{
		"success": true,
		"key":     sessionKey,
	})
}

// sendControlResponse sends a control message response back to the webhook
func (b *Bridge) sendControlResponse(msgType sessions.ControlMessageType, data interface{}) error {
	response, err := sessions.BuildSessionControlResponse(msgType, data)
	if err != nil {
		return err
	}

	if err := b.webhookClient.Send(response); err != nil {
		log.Printf("[Bridge] Failed to send control response: %v", err)
		return err
	}

	return nil
}

// isResetTrigger checks if the message content is a session reset trigger
func (b *Bridge) isResetTrigger(content string) bool {
	normalized := normalizeContent(content)
	for _, trigger := range sessions.DefaultResetTriggers {
		if normalized == trigger {
			return true
		}
	}
	return false
}

// stripResetTrigger strips the reset trigger from the content
func (b *Bridge) stripResetTrigger(content string) string {
	normalized := normalizeContent(content)
	for _, trigger := range sessions.DefaultResetTriggers {
		// Check if content starts with trigger followed by space or end
		if len(normalized) == len(trigger) && normalized == trigger {
			return "" // Just the trigger, return empty
		}
		if len(normalized) > len(trigger)+1 {
			prefix := normalized[:len(trigger)+1]
			if prefix == trigger+" " {
				// Return the rest after the trigger and space
				return content[len(trigger)+1:]
			}
		}
	}
	return content
}

// normalizeContent normalizes content for trigger matching
func normalizeContent(content string) string {
	trimmed := content
	if len(trimmed) > 100 {
		trimmed = trimmed[:100]
	}
	return trimmed
}

// getCurrentTimestamp returns the current timestamp in milliseconds
func getCurrentTimestamp() int64 {
	return time.Now().UnixMilli()
}

// handleCommand processes a command message and sends the response back
func (b *Bridge) handleCommand(content, session, messageID string) error {
	log.Printf("[Bridge] Processing command: %s", content)

	// Handle the command
	response, err := b.commandHandler.HandleCommand(content)
	if err != nil {
		// Check if this is a forward request
		if strings.HasPrefix(err.Error(), "FORWARD_TO_GATEWAY:") {
			// Extract the actual command to forward
			forwardContent := strings.TrimPrefix(err.Error(), "FORWARD_TO_GATEWAY:")
			log.Printf("[Bridge] Forwarding to Gateway: %s", forwardContent)

			// Send to OpenClaw Gateway as an agent request
			if err := b.clawdbotClient.SendAgentRequest(forwardContent, session); err != nil {
				log.Printf("[Bridge] Failed to forward to Gateway: %v", err)
				return err
			}

			// Don't send a response back to webhook - let Gateway handle it
			return nil
		}

		// Other errors - send error message
		log.Printf("[Bridge] Command error: %v", err)
		response = fmt.Sprintf("Error: %v", err)
	}

	// Format the response
	responseData, err := commands.FormatCommandResponse(response, session)
	if err != nil {
		log.Printf("[Bridge] Failed to format command response: %v", err)
		return err
	}

	// Send response back to webhook
	if err := b.webhookClient.Send(responseData); err != nil {
		log.Printf("[Bridge] Failed to send command response: %v", err)
		return err
	}

	return nil
}
