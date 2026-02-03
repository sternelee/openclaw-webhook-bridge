import { WebSocketHub } from './websocket-hub';

// Export the Durable Object class for wrangler.toml
export { WebSocketHub };

// Environment with Durable Object binding
export interface Env {
  WEBSOCKET_HUB: DurableObjectNamespace;
}

// Main worker - routes requests to the Durable Object
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    // Get the Durable Object stub
    const hubId = env.WEBSOCKET_HUB.idFromName('global-hub');
    const hub = env.WEBSOCKET_HUB.get(hubId);

    // Route WebSocket connections to the Durable Object
    if (upgradeHeader === 'websocket') {
      // Forward WebSocket upgrade requests to the Durable Object
      return hub.fetch(request);
    }

    // Route API requests to the Durable Object
    if (url.pathname === '/stats' || url.pathname === '/health') {
      return hub.fetch(request);
    }

    // Serve the test page
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return getTestPage();
    }

    // Broadcast API endpoint
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const body = await request.json() as Record<string, unknown>;
      // Forward to Durable Object
      const broadcastReq = new Request(
        new URL('/broadcast', request.url),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      return hub.fetch(broadcastReq);
    }

    return new Response('Not found', { status: 404 });
  }
};

// Test page HTML
function getTestPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Webhook - WebSocket Test (Durable Objects)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      padding: 20px;
      color: #eee;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 30px; color: #4ade80; }
    .do-badge {
      text-align: center;
      margin-bottom: 20px;
      padding: 8px 16px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid #6366f1;
      border-radius: 20px;
      display: inline-block;
      margin-left: 50%;
      transform: translateX(-50%);
    }
    .do-badge span { color: #a5b4fc; font-size: 0.875rem; }
    .status {
      background: rgba(255,255,255,0.1);
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .status-dot {
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #ef4444;
      transition: background 0.3s;
    }
    .status-dot.connected { background: #22c55e; box-shadow: 0 0 10px #22c55e; }
    .panel {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .panel h2 { font-size: 1.2rem; margin-bottom: 15px; color: #94a3b8; }
    .input-group { display: flex; gap: 10px; margin-bottom: 15px; }
    input[type="text"] {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      color: #fff;
      font-size: 14px;
    }
    input:focus { outline: none; border-color: #4ade80; }
    button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-connect { background: #4ade80; color: #1a1a2e; }
    .btn-connect:hover { background: #22c55e; }
    .btn-connect:disabled { background: #64748b; cursor: not-allowed; }
    .btn-disconnect { background: #ef4444; color: white; }
    .btn-disconnect:hover { background: #dc2626; }
    .btn-send { background: #3b82f6; color: white; }
    .btn-send:hover { background: #2563eb; }
    .btn-send:disabled { background: #64748b; cursor: not-allowed; }
    .messages {
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      padding: 15px;
      height: 300px;
      overflow-y: auto;
      font-family: Monaco, Menlo, monospace;
      font-size: 12px;
    }
    .message { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .message:last-child { border-bottom: none; }
    .message.sent { color: #4ade80; }
    .message.received { color: #60a5fa; }
    .message.error { color: #ef4444; }
    .message.info { color: #94a3b8; }
    .message-time { color: #64748b; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>OpenClaw Webhook WebSocket Test</h1>
    <div class="do-badge"><span>🔗 Powered by Cloudflare Durable Objects</span></div>

    <div class="status">
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText">Disconnected</span>
    </div>

    <div class="panel">
      <h2>Connection</h2>
      <div class="input-group">
        <input type="text" id="wsUrl" value="" placeholder="WebSocket URL">
        <button class="btn-connect" id="connectBtn" onclick="connect()">Connect</button>
        <button class="btn-disconnect" id="disconnectBtn" onclick="disconnect()" disabled>Disconnect</button>
      </div>
    </div>

    <div class="panel">
      <h2>Send Message</h2>
      <div class="input-group">
        <input type="text" id="sessionId" placeholder="Session ID" value="test-session-1">
        <input type="text" id="messageContent" placeholder="Your message...">
        <button class="btn-send" id="sendBtn" onclick="sendMessage()" disabled>Send</button>
      </div>
    </div>

    <div class="panel">
      <h2>Messages</h2>
      <div class="messages" id="messages"></div>
    </div>
  </div>

  <script>
    // Auto-detect WebSocket URL based on current page
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = wsProtocol + '//' + window.location.host + '/ws';
    document.getElementById('wsUrl').value = wsUrl;

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
      ws = new WebSocket(url);

      ws.onopen = () => {
        setStatus(true);
        addMessage('info', 'Connected to WebSocket server (Durable Object)');
      };

      ws.onmessage = (event) => {
        receivedCount++;
        try {
          const data = JSON.parse(event.data);
          addMessage('received', 'Message: ' + JSON.stringify(data));
        } catch (e) {
          addMessage('received', 'Raw: ' + event.data);
        }
      };

      ws.onerror = () => {
        errorCount++;
        addMessage('error', 'WebSocket error occurred');
      };

      ws.onclose = (event) => {
        setStatus(false);
        addMessage('info', 'Disconnected (code: ' + event.code + ')');
      };
    }

    function disconnect() {
      if (ws) { ws.close(); ws = null; }
    }

    function sendMessage() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        addMessage('error', 'WebSocket is not connected');
        return;
      }

      const session = document.getElementById('sessionId').value.trim();
      const content = document.getElementById('messageContent').value.trim();

      if (!session || !content) {
        addMessage('error', 'Please provide session ID and message');
        return;
      }

      const message = {
        id: 'msg-' + Date.now() + '-' + ++messageId,
        content: content,
        session: session
      };

      ws.send(JSON.stringify(message));
      sentCount++;
      addMessage('sent', 'Sent: ' + JSON.stringify(message));
      document.getElementById('messageContent').value = '';
    }

    document.getElementById('messageContent').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
