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

	// Event callback
	onEvent EventCallback
}

// NewClient creates a new OpenClaw Gateway client
func NewClient(port int, token, agentID string) *Client {
	return &Client{
		port:    port,
		token:   token,
		agentID: agentID,
	}
}

// SetEventCallback sets the callback for OpenClaw events
func (c *Client) SetEventCallback(cb EventCallback) {
	c.onEvent = cb
}

// Connect establishes a persistent WebSocket connection to the gateway
func (c *Client) Connect(ctx context.Context) error {
	c.ctx, c.cancel = context.WithCancel(ctx)

	// Start connection loop
	c.wg.Add(1)
	go c.connectionLoop()

	// Wait for connection to be established
	for i := 0; i < 50; i++ {
		if c.connected.Load() {
			log.Printf("[OpenClaw] Connected to gateway")
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}

	return fmt.Errorf("timeout connecting to gateway")
}

// Close gracefully shuts down the connection
func (c *Client) Close() error {
	log.Printf("[OpenClaw] Closing connection...")

	c.cancel()
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
	defer c.connected.Store(false)

	// Read messages and forward to callback
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read error: %w", err)
		}

		log.Printf("[OpenClaw] Received: %s", string(message))

		// Forward raw event to callback
		if c.onEvent != nil {
			c.onEvent(message)
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
	// Wait for connection
	for i := 0; i < 100; i++ {
		if c.connected.Load() {
			break
		}
		if i == 0 {
			log.Printf("[OpenClaw] Waiting for connection...")
		}
		time.Sleep(50 * time.Millisecond)
	}

	if !c.connected.Load() {
		return fmt.Errorf("not connected to gateway")
	}

	c.connMu.RLock()
	conn := c.conn
	c.connMu.RUnlock()

	if conn == nil {
		return fmt.Errorf("connection lost")
	}

	log.Printf("[OpenClaw] Sending: %s", string(data))

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return fmt.Errorf("failed to send: %w", err)
	}

	return nil
}

// SendAgentRequest sends an agent request to OpenClaw
func (c *Client) SendAgentRequest(message, sessionKey string) error {
	req := map[string]interface{}{
		"type":   "req",
		"id":     fmt.Sprintf("agent:%d", time.Now().UnixNano()),
		"method": "agent",
		"params": map[string]interface{}{
			"message":        message,
			"agentId":        c.agentID,
			"sessionKey":     sessionKey,
			"deliver":        true,
			"idempotencyKey": fmt.Sprintf("%d", time.Now().UnixNano()),
		},
	}

	data, err := json.Marshal(req)
	if err != nil {
		return err
	}

	return c.SendRaw(data)
}
