import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/cloudflare-workers';

// Types for WebSocket messages
interface ClientMessage {
  id: string;
  content: string;
  session: string;
}

interface BridgeEvent {
  type: string;
  event: string;
  payload: unknown;
}

type Env = {
  Bindings: {
    // Add your Cloudflare bindings here
    // CLAWDBOT_BRIDGE_URL?: string;
  };
};

const app = new Hono<Env>();

// Store active WebSocket connections
// Using a generic type that works with Hono's WSContext
const connections = new Map<string, any>();

// Health check endpoint with test page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ClawdBot Webhook - WebSocket Test</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          min-height: 100vh;
          padding: 20px;
          color: #eee;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          text-align: center;
          margin-bottom: 30px;
          color: #4ade80;
        }
        .status {
          background: rgba(255, 255, 255, 0.1);
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ef4444;
          transition: background 0.3s;
        }
        .status-dot.connected {
          background: #22c55e;
          box-shadow: 0 0 10px #22c55e;
        }
        .panel {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .panel h2 {
          font-size: 1.2rem;
          margin-bottom: 15px;
          color: #94a3b8;
        }
        .input-group {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }
        input[type="text"] {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          font-size: 14px;
        }
        input[type="text"]:focus {
          outline: none;
          border-color: #4ade80;
        }
        button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-connect {
          background: #4ade80;
          color: #1a1a2e;
        }
        .btn-connect:hover {
          background: #22c55e;
        }
        .btn-connect:disabled {
          background: #64748b;
          cursor: not-allowed;
        }
        .btn-disconnect {
          background: #ef4444;
          color: white;
        }
        .btn-disconnect:hover {
          background: #dc2626;
        }
        .btn-send {
          background: #3b82f6;
          color: white;
        }
        .btn-send:hover {
          background: #2563eb;
        }
        .btn-send:disabled {
          background: #64748b;
          cursor: not-allowed;
        }
        .messages {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          padding: 15px;
          height: 300px;
          overflow-y: auto;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 12px;
        }
        .message {
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .message:last-child {
          border-bottom: none;
        }
        .message.sent {
          color: #4ade80;
        }
        .message.received {
          color: #60a5fa;
        }
        .message.error {
          color: #ef4444;
        }
        .message.info {
          color: #94a3b8;
        }
        .message-time {
          color: #64748b;
          margin-right: 8px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
        }
        .stat {
          text-align: center;
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }
        .stat-value {
          font-size: 2rem;
          font-weight: bold;
          color: #4ade80;
        }
        .stat-label {
          font-size: 0.875rem;
          color: #94a3b8;
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>ClawdBot Webhook WebSocket Test</h1>

        <div class="status">
          <span class="status-dot" id="statusDot"></span>
          <span id="statusText">Disconnected</span>
        </div>

        <div class="panel">
          <h2>Connection</h2>
          <div class="input-group">
            <input type="text" id="wsUrl" value="ws://localhost:8787/ws" placeholder="WebSocket URL">
            <button class="btn-connect" id="connectBtn" onclick="connect()">Connect</button>
            <button class="btn-disconnect" id="disconnectBtn" onclick="disconnect()" disabled>Disconnect</button>
          </div>
        </div>

        <div class="panel">
          <h2>Send Message</h2>
          <div class="input-group">
            <input type="text" id="sessionId" placeholder="Session ID (e.g., session-123)" value="test-session-1">
            <input type="text" id="messageContent" placeholder="Your message to ClawdBot...">
            <button class="btn-send" id="sendBtn" onclick="sendMessage()" disabled>Send</button>
          </div>
        </div>

        <div class="panel">
          <h2>Messages</h2>
          <div class="messages" id="messages"></div>
        </div>

        <div class="panel">
          <h2>Statistics</h2>
          <div class="stats">
            <div class="stat">
              <div class="stat-value" id="sentCount">0</div>
              <div class="stat-label">Messages Sent</div>
            </div>
            <div class="stat">
              <div class="stat-value" id="receivedCount">0</div>
              <div class="stat-label">Messages Received</div>
            </div>
            <div class="stat">
              <div class="stat-value" id="errorCount">0</div>
              <div class="stat-label">Errors</div>
            </div>
          </div>
        </div>
      </div>

      <script>
        let ws = null;
        let sentCount = 0;
        let receivedCount = 0;
        let errorCount = 0;
        let messageId = 0;

        function addMessage(type, text) {
          const messagesDiv = document.getElementById('messages');
          const time = new Date().toLocaleTimeString();
          const messageDiv = document.createElement('div');
          messageDiv.className = 'message ' + type;
          messageDiv.innerHTML = '<span class="message-time">[' + time + ']</span>' + text;
          messagesDiv.appendChild(messageDiv);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function updateStats() {
          document.getElementById('sentCount').textContent = sentCount;
          document.getElementById('receivedCount').textContent = receivedCount;
          document.getElementById('errorCount').textContent = errorCount;
        }

        function setStatus(connected) {
          const dot = document.getElementById('statusDot');
          const text = document.getElementById('statusText');
          const connectBtn = document.getElementById('connectBtn');
          const disconnectBtn = document.getElementById('disconnectBtn');
          const sendBtn = document.getElementById('sendBtn');

          if (connected) {
            dot.classList.add('connected');
            text.textContent = 'Connected';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            sendBtn.disabled = false;
          } else {
            dot.classList.remove('connected');
            text.textContent = 'Disconnected';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            sendBtn.disabled = true;
          }
        }

        function connect() {
          const url = document.getElementById('wsUrl').value;

          try {
            ws = new WebSocket(url);

            ws.onopen = () => {
              setStatus(true);
              addMessage('info', 'Connected to WebSocket server');
            };

            ws.onmessage = (event) => {
              receivedCount++;
              updateStats();

              try {
                const data = JSON.parse(event.data);
                addMessage('received', 'Bridge event: ' + JSON.stringify(data, null, 2));

                // Handle different event types
                if (data.event === 'agent') {
                  console.log('Agent event:', data.payload);
                } else if (data.event === 'status') {
                  console.log('Status update:', data.payload);
                }
              } catch (e) {
                addMessage('received', 'Raw message: ' + event.data);
              }
            };

            ws.onerror = (error) => {
              errorCount++;
              updateStats();
              addMessage('error', 'WebSocket error occurred');
              console.error('WebSocket error:', error);
            };

            ws.onclose = (event) => {
              setStatus(false);
              addMessage('info', 'Disconnected (code: ' + event.code + ', reason: ' + (event.reason || 'none') + ')');
            };
          } catch (error) {
            errorCount++;
            updateStats();
            addMessage('error', 'Failed to connect: ' + error.message);
          }
        }

        function disconnect() {
          if (ws) {
            ws.close();
            ws = null;
          }
        }

        function sendMessage() {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            addMessage('error', 'WebSocket is not connected');
            return;
          }

          const session = document.getElementById('sessionId').value.trim();
          const content = document.getElementById('messageContent').value.trim();

          if (!session || !content) {
            addMessage('error', 'Please provide both session ID and message content');
            return;
          }

          const message = {
            id: 'msg-' + Date.now() + '-' + ++messageId,
            content: content,
            session: session
          };

          try {
            ws.send(JSON.stringify(message));
            sentCount++;
            updateStats();
            addMessage('sent', 'Sent: ' + JSON.stringify(message));
            document.getElementById('messageContent').value = '';
          } catch (error) {
            errorCount++;
            updateStats();
            addMessage('error', 'Failed to send message: ' + error.message);
          }
        }

        // Allow sending with Enter key
        document.getElementById('messageContent').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            sendMessage();
          }
        });

        // Auto-connect on page load (optional)
        // connect();
      </script>
    </body>
    </html>
  `);
});

// WebSocket endpoint
app.get('/ws', upgradeWebSocket((c) => {
  return {
    onOpen(event: any, ws: any) {
      console.log('WebSocket connection opened');
      const connectionId = crypto.randomUUID();
      connections.set(connectionId, ws);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        connectionId: connectionId,
        timestamp: new Date().toISOString()
      }));
    },

    onMessage(event: any, ws: any) {
      try {
        const data: any = JSON.parse(event.data.toString());
        console.log('Received message from client:', data);

        // Check if this is a user message (no 'type' field) or a bridge event (has 'type' field)
        if (!data.type) {
          // This is a user message - forward it to all connected clients (including the bridge)
          // The bridge will pick it up and forward to ClawdBot
          const broadcastMsg = JSON.stringify(data);
          let sentCount = 0;
          for (const [id, socket] of connections.entries()) {
            try {
              socket.send(broadcastMsg);
              sentCount++;
            } catch (error) {
              console.error('Failed to send to connection ' + id + ':', error);
              connections.delete(id);
            }
          }
          console.log('Broadcasted user message to', sentCount, 'connections');
        } else {
          // This is a bridge event or control message - just broadcast it
          const broadcastMsg = JSON.stringify(data);
          let sentCount = 0;
          for (const [id, socket] of connections.entries()) {
            try {
              socket.send(broadcastMsg);
              sentCount++;
            } catch (error) {
              console.error('Failed to send to connection ' + id + ':', error);
              connections.delete(id);
            }
          }
          console.log('Broadcasted event to', sentCount, 'connections');
        }

      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    },

    onClose(event: any, ws: any) {
      console.log('WebSocket connection closed:', event.code, event.reason);

      // Remove connection from active connections
      for (const [id, socket] of connections.entries()) {
        if (socket === ws) {
          connections.delete(id);
          break;
        }
      }
    },

    onError(error: any, ws: any) {
      console.error('WebSocket error:', error);
    }
  };
}));

// API endpoint to send messages to all connected clients
app.post('/broadcast', async (c) => {
  const body = await c.req.json() as BridgeEvent;

  let sentCount = 0;
  for (const [id, ws] of connections.entries()) {
    try {
      ws.send(JSON.stringify(body));
      sentCount++;
    } catch (error) {
      console.error('Failed to send to connection ' + id + ':', error);
      connections.delete(id);
    }
  }

  return c.json({
    success: true,
    sentTo: sentCount,
    totalConnections: connections.size
  });
});

// API endpoint to get connection stats
app.get('/stats', (c) => {
  return c.json({
    activeConnections: connections.size,
    connections: Array.from(connections.keys())
  });
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeConnections: connections.size
  });
});

export default app;
