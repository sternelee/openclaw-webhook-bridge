import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 8787;
const HOST = '127.0.0.1';

const connections = new Map();

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const html = readFileSync(join(__dirname, 'test-page.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeConnections: connections.size,
      connections: Array.from(connections.keys())
    }));
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeConnections: connections.size
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const connId = 'conn-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  console.log('Connection opened:', connId);
  connections.set(connId, ws);

  ws.send(JSON.stringify({
    type: 'connected',
    connectionId: connId,
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('Received from', connId, ':', JSON.stringify(msg));

      const broadcastMsg = JSON.stringify(msg);
      let sentCount = 0;

      for (const [id, socket] of connections.entries()) {
        if (socket.readyState === 1) { // OPEN
          try {
            socket.send(broadcastMsg);
            sentCount++;
          } catch (e) {
            connections.delete(id);
          }
        }
      }
      console.log('Broadcasted to', sentCount, 'connections');
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Connection closed:', connId);
    connections.delete(connId);
  });

  ws.on('error', (e) => {
    console.error('WebSocket error:', e);
    connections.delete(connId);
  });
});

server.listen(PORT, HOST, () => {
  console.log('WebSocket server started on ws://' + HOST + ':' + PORT + '/ws');
  console.log('Test page: http://' + HOST + ':' + PORT + '/');
});

process.on('SIGINT', () => {
  for (const ws of connections.values()) {
    try { ws.close(); } catch (e) { }
  }
  server.close(() => process.exit(0));
});
