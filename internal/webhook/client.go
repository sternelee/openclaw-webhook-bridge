package webhook

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// MessageHandler is called when a message is received from the webhook
// The data is raw JSON bytes that will be forwarded directly to OpenClaw
type MessageHandler func(data []byte) error

// ResponseHandler is called when a response from OpenClaw should be forwarded to webhook
// The data is raw JSON bytes from OpenClaw
type ResponseHandler func() ([]byte, error)

// Client is a WebSocket webhook client
type Client struct {
	url       string
	uid       string // Unique ID for this bridge
	handler   MessageHandler
	conn      *websocket.Conn
	connMu    sync.RWMutex
	connected atomic.Bool
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
}

// NewClient creates a new webhook client
func NewClient(url string, handler MessageHandler, uid string) *Client {
	return &Client{
		url:     url,
		uid:     uid,
		handler: handler,
	}
}

// Connect establishes a WebSocket connection to the webhook server
func (c *Client) Connect(ctx context.Context) error {
	// Validate UID is required
	if c.uid == "" {
		return fmt.Errorf("UID is required for connection. Please configure a unique UID for this bridge instance")
	}

	c.ctx, c.cancel = context.WithCancel(ctx)

	// Start connection loop
	c.wg.Add(1)
	go c.connectionLoop()

	// Wait for connection to be established
	for i := 0; i < 50; i++ {
		if c.connected.Load() {
			log.Printf("[Webhook] Connected to %s (UID: %s)", c.url, c.uid)
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}

	return fmt.Errorf("timeout connecting to webhook server")
}

// Close gracefully shuts down the connection
func (c *Client) Close() error {
	log.Printf("[Webhook] Closing connection...")

	c.cancel()
	c.wg.Wait()

	c.connMu.Lock()
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
	c.connMu.Unlock()

	c.connected.Store(false)
	log.Printf("[Webhook] Connection closed")
	return nil
}

// connectionLoop maintains a persistent connection with auto-reconnect
func (c *Client) connectionLoop() {
	defer c.wg.Done()

	reconnectDelay := 2 * time.Second
	maxReconnectDelay := 30 * time.Second

	for {
		select {
		case <-c.ctx.Done():
			log.Printf("[Webhook] Connection loop: context cancelled")
			return
		default:
		}

		if err := c.connectAndRead(); err != nil {
			log.Printf("[Webhook] Connection error: %v", err)

			// Exponential backoff for reconnection
			if reconnectDelay < maxReconnectDelay {
				reconnectDelay *= 2
			}
		} else {
			// Successful connection, reset delay
			reconnectDelay = 2 * time.Second
		}

		// Wait before reconnecting (or exit if context cancelled)
		select {
		case <-c.ctx.Done():
			return
		case <-time.After(reconnectDelay):
			log.Printf("[Webhook] Reconnecting...")
		}
	}
}

// connectAndRead establishes connection and reads messages
func (c *Client) connectAndRead() error {
	// Append UID to URL for identification
	wsURL := c.url
	if c.uid != "" {
		// Check if URL already has query params
		separator := "?"
		if strings.Contains(wsURL, "?") {
			separator = "&"
		}
		wsURL = wsURL + separator + "uid=" + url.QueryEscape(c.uid)
	}

	log.Printf("[Webhook] Connecting to %s (UID: %s)", wsURL, c.uid)

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("failed to dial: %w", err)
	}

	c.connMu.Lock()
	c.conn = conn
	c.connMu.Unlock()

	c.connected.Store(true)
	defer c.connected.Store(false)

	// Read messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read error: %w", err)
		}

		// Don't log message content for privacy - message content may be sensitive

		// Call handler with raw JSON bytes
		if c.handler != nil {
			if err := c.handler(message); err != nil {
				log.Printf("[Webhook] Handler error: %v", err)
			}
		}
	}
}

// Send forwards raw JSON data to the webhook (from OpenClaw)
func (c *Client) Send(data []byte) error {
	c.connMu.RLock()
	conn := c.conn
	c.connMu.RUnlock()

	if conn == nil {
		return fmt.Errorf("not connected")
	}

	// Don't log message content for privacy

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return fmt.Errorf("failed to send: %w", err)
	}

	return nil
}
