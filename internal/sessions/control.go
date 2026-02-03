package sessions

import (
	"encoding/json"
	"fmt"
)

// ControlMessageType defines the type of session control message
type ControlMessageType string

const (
	// ControlMessageSessionGet queries session information
	ControlMessageSessionGet ControlMessageType = "session.get"
	// ControlMessageSessionList lists all sessions
	ControlMessageSessionList ControlMessageType = "session.list"
	// ControlMessageSessionReset resets a session
	ControlMessageSessionReset ControlMessageType = "session.reset"
	// ControlMessageSessionDelete deletes a session
	ControlMessageSessionDelete ControlMessageType = "session.delete"
)

// SessionControlMessage represents a session control message
type SessionControlMessage struct {
	Type   ControlMessageType `json:"type"`
	Key    string            `json:"key,omitempty"`     // Session key
	ID     string            `json:"id,omitempty"`      // Session ID (alternative to key)
	Action string            `json:"action,omitempty"`  // Action to perform
}

// SessionInfoResponse contains session information
type SessionInfoResponse struct {
	Key             string           `json:"key"`
	SessionID       string           `json:"sessionId"`
	UpdatedAt       int64            `json:"updatedAt"`
	DeliveryContext *DeliveryContext `json:"deliveryContext,omitempty"`
	LastChannel     string           `json:"lastChannel,omitempty"`
	LastTo          string           `json:"lastTo,omitempty"`
	MessageCount    int              `json:"messageCount,omitempty"`
}

// SessionListResponse contains a list of sessions
type SessionListResponse struct {
	Sessions []SessionInfoResponse `json:"sessions"`
	Count    int                   `json:"count"`
}

// IsSessionControlMessage checks if a message is a session control message
func IsSessionControlMessage(data []byte) bool {
	var msg struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return false
	}
	return msg.Type == string(ControlMessageSessionGet) ||
		msg.Type == string(ControlMessageSessionList) ||
		msg.Type == string(ControlMessageSessionReset) ||
		msg.Type == string(ControlMessageSessionDelete)
}

// ParseSessionControlMessage parses a session control message
func ParseSessionControlMessage(data []byte) (*SessionControlMessage, error) {
	var msg SessionControlMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("failed to parse control message: %w", err)
	}
	return &msg, nil
}

// BuildSessionControlResponse builds a response for a session control message
func BuildSessionControlResponse(msgType ControlMessageType, data interface{}) ([]byte, error) {
	response := map[string]interface{}{
		"type": msgType,
		"data": data,
	}
	return json.Marshal(response)
}
