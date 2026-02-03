// Type definition for Cloudflare Workers environment
export interface Env {
  WEBSOCKET_HUB: DurableObjectNamespace;
}

// Durable Object for managing WebSocket connections
export class WebSocketHub {
  // Storage for the Durable Object
  private state: DurableObjectState;
  // Map of WebSocket connections: connectionId -> WebSocket
  private connections: Map<string, WebSocket> = new Map();
  // Map of WebSocket to connectionId for reverse lookup
  private socketToId: Map<WebSocket, string> = new Map();
  // Env for accessing bindings
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Handle WebSocket connections
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    // Handle WebSocket upgrade
    if (upgradeHeader === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle regular HTTP requests
    if (url.pathname === '/stats') {
      return Response.json({
        activeConnections: this.connections.size,
        connections: Array.from(this.connections.keys())
      });
    }

    if (url.pathname === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeConnections: this.connections.size
      });
    }

    // Handle broadcast API endpoint
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const body = await request.json() as Record<string, unknown>;
        this.broadcast(body);
        return Response.json({
          success: true,
          sentTo: this.connections.size,
          totalConnections: this.connections.size
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    return new Response('Not found', { status: 404 });
  }

  // Handle WebSocket upgrade and message handling
  private handleWebSocket(request: Request): Response {
    const { 0: client, 1: server } = Object.values(new WebSocketPair());
    const connectionId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // Accept the WebSocket connection
    server.accept();

    // Store the connection
    this.connections.set(connectionId, server);
    this.socketToId.set(server, connectionId);

    console.log(`[WebSocketHub] Connection opened: ${connectionId}`);

    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      connectionId: connectionId,
      timestamp: new Date().toISOString()
    }));

    // Handle incoming messages
    server.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(connectionId, event.data);
    });

    // Handle connection close
    server.addEventListener('close', (event: CloseEvent) => {
      console.log(`[WebSocketHub] Connection closed: ${connectionId} (code: ${event.code})`);
      this.connections.delete(connectionId);
      this.socketToId.delete(server);
    });

    // Handle errors
    server.addEventListener('error', (event: ErrorEvent) => {
      console.error(`[WebSocketHub] WebSocket error for ${connectionId}:`, event.message);
      this.connections.delete(connectionId);
      this.socketToId.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // Handle messages from clients
  private handleMessage(connectionId: string, data: string | ArrayBuffer): void {
    try {
      const message = JSON.parse(data as string);
      console.log(`[WebSocketHub] Received from ${connectionId}:`, JSON.stringify(message));

      // Broadcast to ALL connected clients
      this.broadcast(message);
    } catch (error) {
      console.error(`[WebSocketHub] Error processing message from ${connectionId}:`, error);

      // Send error back to the client
      const socket = this.connections.get(connectionId);
      if (socket) {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    }
  }

  // Broadcast a message to all connected clients
  private broadcast(message: unknown): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const [id, socket] of this.connections.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(`[WebSocketHub] Failed to send to ${id}:`, error);
          // Remove dead connections
          this.connections.delete(id);
          this.socketToId.delete(socket);
        }
      }
    }

    console.log(`[WebSocketHub] Broadcasted to ${sentCount}/${this.connections.size} connections`);
  }

  // Get connection count (for health checks)
  getConnectionCount(): number {
    return this.connections.size;
  }
}
