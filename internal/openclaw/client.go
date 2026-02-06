package openclaw

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// EventCallback is called for each event from OpenClaw Gateway
// The data is the raw JSON event message
type EventCallback func(data []byte)

// Client is an OpenClaw Gateway WebSocket client with persistent connection
type Client struct {
	port    int
	token   string
	agentID string

	// Persistent connection
	conn      *websocket.Conn
	connMu    sync.RWMutex
	connected atomic.Bool
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup

	// Connection state notification
	connCond *sync.Cond

	// Event callback
	onEvent EventCallback

	// Pending requests (for request/response pattern)
	pendingRequests   map[string]chan []byte
	pendingRequestsMu sync.RWMutex
}

// requestPool is a sync.Pool for reusing request objects
var requestPool = sync.Pool{
	New: func() interface{} {
		return &agentRequest{
			Params: &agentRequestParams{},
		}
	},
}

// agentRequest represents a request to OpenClaw Gateway
type agentRequest struct {
	Type   string              `json:"type"`
	ID     string              `json:"id"`
	Method string              `json:"method"`
	Params *agentRequestParams `json:"params"`
}

// agentRequestParams represents the parameters for an agent request
type agentRequestParams struct {
	Message        string `json:"message"`
	AgentID        string `json:"agentId"`
	SessionKey     string `json:"sessionKey"`
	Deliver        bool   `json:"deliver"`
	IdempotencyKey string `json:"idempotencyKey"`
}

// NewClient creates a new OpenClaw Gateway client
func NewClient(port int, token, agentID string) *Client {
	return &Client{
		port:            port,
		token:           token,
		agentID:         agentID,
		pendingRequests: make(map[string]chan []byte),
		connCond:        sync.NewCond(&sync.Mutex{}),
	}
}

// SetEventCallback sets the callback for OpenClaw events
func (c *Client) SetEventCallback(cb EventCallback) {
	c.onEvent = cb
}

// AgentID returns the configured agent ID for this client.
func (c *Client) AgentID() string {
	return c.agentID
}

// Connect establishes a persistent WebSocket connection to the gateway
func (c *Client) Connect(ctx context.Context) error {
	c.ctx, c.cancel = context.WithCancel(ctx)

	// Start connection loop
	c.wg.Add(1)
	go c.connectionLoop()

	// Wait for connection to be established using condition variable
	c.connCond.L.Lock()
	defer c.connCond.L.Unlock()

	timeout := time.NewTimer(5 * time.Second)
	defer timeout.Stop()

	for !c.connected.Load() {
		select {
		case <-c.ctx.Done():
			return fmt.Errorf("context cancelled while waiting for connection")
		case <-timeout.C:
			return fmt.Errorf("timeout connecting to gateway")
		default:
			// Wait for signal with timeout
			done := make(chan struct{})
			go func() {
				c.connCond.Wait()
				close(done)
			}()
			select {
			case <-done:
				// Woke up from Wait, check connected again
			case <-timeout.C:
				return fmt.Errorf("timeout connecting to gateway")
			case <-c.ctx.Done():
				return fmt.Errorf("context cancelled while waiting for connection")
			}
		}
	}

	log.Printf("[OpenClaw] Connected to gateway")
	return nil
}

// Close gracefully shuts down the connection
func (c *Client) Close() error {
	log.Printf("[OpenClaw] Closing connection...")

	c.cancel()

	// Wake up any waiters
	c.connCond.Broadcast()

	c.wg.Wait()

	c.connMu.Lock()
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
	c.connMu.Unlock()

	c.connected.Store(false)
	log.Printf("[OpenClaw] Connection closed")
	return nil
}

// connectionLoop maintains a persistent connection with auto-reconnect
func (c *Client) connectionLoop() {
	defer c.wg.Done()

	reconnectDelay := 1 * time.Second
	maxReconnectDelay := 30 * time.Second

	for {
		select {
		case <-c.ctx.Done():
			log.Printf("[OpenClaw] Connection loop: context cancelled")
			return
		default:
		}

		if err := c.connectAndRead(); err != nil {
			log.Printf("[OpenClaw] Connection error: %v", err)

			// Exponential backoff for reconnection
			if reconnectDelay < maxReconnectDelay {
				reconnectDelay *= 2
			}
		} else {
			// Successful connection, reset delay
			reconnectDelay = 1 * time.Second
		}

		// Wait before reconnecting (or exit if context cancelled)
		select {
		case <-c.ctx.Done():
			return
		case <-time.After(reconnectDelay):
			log.Printf("[OpenClaw] Reconnecting...")
		}
	}
}

// connectAndRead establishes connection and reads messages
func (c *Client) connectAndRead() error {
	url := fmt.Sprintf("ws://127.0.0.1:%d", c.port)

	log.Printf("[OpenClaw] Connecting to %s", url)
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return fmt.Errorf("failed to dial: %w", err)
	}

	c.connMu.Lock()
	c.conn = conn
	c.connMu.Unlock()

	// Send connect request immediately
	if err := c.sendConnectRequest(conn); err != nil {
		conn.Close()
		return fmt.Errorf("failed to send connect request: %w", err)
	}

	c.connected.Store(true)
	c.connCond.Broadcast() // Wake up any waiters
	defer func() {
		c.connected.Store(false)
		c.connCond.Broadcast() // Wake up any waiters on disconnect
	}()

	// Read messages and forward to callback
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read error: %w", err)
		}

		// Don't log message content for privacy

		// Check if this is a response to a pending request
		c.handlePossibleResponse(message)

		// Forward raw event to callback
		if c.onEvent != nil {
			c.onEvent(message)
		}
	}
}

// handlePossibleResponse checks if message is a response to a pending request
func (c *Client) handlePossibleResponse(message []byte) {
	var responseWrapper struct {
		ID   string          `json:"id"`
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}

	if err := json.Unmarshal(message, &responseWrapper); err != nil {
		return
	}

	if responseWrapper.ID == "" || responseWrapper.Type != "response" {
		return
	}

	c.pendingRequestsMu.RLock()
	ch, exists := c.pendingRequests[responseWrapper.ID]
	c.pendingRequestsMu.RUnlock()

	if exists {
		select {
		case ch <- message:
		default:
		}
	}
}

// sendConnectRequest sends the initial connect handshake
func (c *Client) sendConnectRequest(conn *websocket.Conn) error {
	connectReq := map[string]interface{}{
		"type":   "req",
		"id":     "connect",
		"method": "connect",
		"params": map[string]interface{}{
			"minProtocol": 3,
			"maxProtocol": 3,
			"client": map[string]string{
				"id":       "gateway-client",
				"version":  "0.2.0",
				"platform": "linux",
				"mode":     "backend",
			},
			"role":   "operator",
			"scopes": []string{"operator.read", "operator.write", "operator.admin"},
			"auth": map[string]string{
				"token": c.token,
			},
			"locale":    "zh-CN",
			"userAgent": "openclaw-bridge-go",
		},
	}

	return conn.WriteJSON(connectReq)
}

// SendRaw sends raw JSON data to OpenClaw Gateway
func (c *Client) SendRaw(data []byte) error {
	// Wait for connection with condition variable
	c.connCond.L.Lock()
	defer c.connCond.L.Unlock()

	timeout := time.NewTimer(5 * time.Second)
	defer timeout.Stop()

	for !c.connected.Load() {
		select {
		case <-c.ctx.Done():
			return fmt.Errorf("client closed")
		case <-timeout.C:
			return fmt.Errorf("timeout waiting for connection")
		default:
			// Wait for signal with timeout
			done := make(chan struct{})
			go func() {
				c.connCond.Wait()
				close(done)
			}()
			select {
			case <-done:
				// Woke up from Wait, check connected again
			case <-timeout.C:
				return fmt.Errorf("timeout waiting for connection")
			case <-c.ctx.Done():
				return fmt.Errorf("client closed")
			}
		}
	}

	c.connMu.RLock()
	conn := c.conn
	c.connMu.RUnlock()

	if conn == nil {
		return fmt.Errorf("connection lost")
	}

	// Don't log message content for privacy

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return fmt.Errorf("failed to send: %w", err)
	}

	return nil
}

// SendAgentRequest sends an agent request to OpenClaw using object pooling
func (c *Client) SendAgentRequest(message, sessionKey string) error {
	// Get request from pool
	req := requestPool.Get().(*agentRequest)
	defer func() {
		// Reset and return to pool
		req.Type = ""
		req.ID = ""
		req.Method = ""
		if req.Params != nil {
			req.Params.Message = ""
			req.Params.AgentID = ""
			req.Params.SessionKey = ""
			req.Params.IdempotencyKey = ""
		}
		requestPool.Put(req)
	}()

	// Populate request
	now := time.Now().UnixNano()
	req.Type = "req"
	req.ID = fmt.Sprintf("agent:%d", now)
	req.Method = "agent"
	req.Params.Message = message
	req.Params.AgentID = c.agentID
	req.Params.SessionKey = sessionKey
	req.Params.Deliver = true
	req.Params.IdempotencyKey = fmt.Sprintf("%d", now)

	data, err := json.Marshal(req)
	if err != nil {
		return err
	}

	return c.SendRaw(data)
}

// sendRequestAndWait sends a request and waits for the response
func (c *Client) sendRequestAndWait(method string, params interface{}, timeout time.Duration) ([]byte, error) {
	if !c.connected.Load() {
		return nil, fmt.Errorf("not connected to gateway")
	}

	requestID := fmt.Sprintf("%s:%d", method, time.Now().UnixNano())

	// Create response channel
	respChan := make(chan []byte, 1)
	c.pendingRequestsMu.Lock()
	c.pendingRequests[requestID] = respChan
	c.pendingRequestsMu.Unlock()

	defer func() {
		c.pendingRequestsMu.Lock()
		delete(c.pendingRequests, requestID)
		c.pendingRequestsMu.Unlock()
		close(respChan)
	}()

	// Send request
	req := map[string]interface{}{
		"type":   "req",
		"id":     requestID,
		"method": method,
		"params": params,
	}

	data, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	if err := c.SendRaw(data); err != nil {
		return nil, err
	}

	// Wait for response with timeout
	select {
	case response := <-respChan:
		return response, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("request timeout")
	case <-c.ctx.Done():
		return nil, fmt.Errorf("client closed")
	}
}

// SendApproval sends an approval/denial for a pending request
func (c *Client) SendApproval(requestID string, approved bool) error {
	log.Printf("[OpenClaw] Sending approval: requestID=%s approved=%v", requestID, approved)

	params := map[string]interface{}{
		"requestId": requestID,
		"approved":  approved,
	}

	_, err := c.sendRequestAndWait("approval.respond", params, 5*time.Second)
	if err != nil {
		return fmt.Errorf("failed to send approval: %w", err)
	}

	return nil
}
