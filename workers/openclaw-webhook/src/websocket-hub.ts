// Type definition for Cloudflare Workers environment
export interface Env {
  WEBSOCKET_HUB: DurableObjectNamespace;
}

// Durable Object for managing WebSocket connections
// Following the Fiberplane pattern for Hono + Durable Objects + WebSocket Hibernation
export class WebSocketHub {
  // Set of WebSocket connections (using Set for simpler management)
  connections: Set<WebSocket> = new Set();
  // Storage for the Durable Object state (WebSocket hibernation API)
  readonly #state: DurableObjectState;
  // Env for accessing bindings
  readonly #env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.#state = state;
    this.#env = env;

    // IMPORTANT: Restore WebSocket connections after hibernation
    // When a Durable Object wakes up from hibernation, we need to
    // retrieve all existing WebSocket connections
    const websockets = this.#state.getWebSockets();
    for (const ws of websockets) {
      this.connections.add(ws);
    }
    console.log(`[WebSocketHub] Awake from hibernation, connections: ${this.connections.size}`);
  }

  // Fetch method - main communication layer between Worker and Durable Object
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    // Handle WebSocket upgrade
    if (upgradeHeader === 'websocket') {
      // Create WebSocket pair
      const websocketPair = new WebSocketPair();
      const [client, server] = Object.values(websocketPair);

      // IMPORTANT: Use acceptWebSocket() for hibernation support
      // This allows the Durable Object to hibernate and save memory when inactive
      this.#state.acceptWebSocket(server);

      // Add client to connections set
      this.connections.add(client);
      console.log(`[WebSocketHub] WebSocket accepted, total connections: ${this.connections.size}`);

      // Send welcome message to client
      client.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        connections: this.connections.size
      }));

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    // Handle broadcast API endpoint
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const body = await request.json() as Record<string, unknown>;
        const msgStr = JSON.stringify(body);
        this.broadcast(msgStr);
        return Response.json({
          success: true,
          sentTo: this.connections.size
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    // Handle stats endpoint
    if (url.pathname === '/stats') {
      return Response.json({
        activeConnections: this.connections.size
      });
    }

    // Handle health endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeConnections: this.connections.size
      });
    }

    return new Response('Not found', { status: 404 });
  }

  // WebSocket message handler - called when client sends a message
  webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    try {
      const message = JSON.parse(data as string);
      console.log('[WebSocketHub] Received from client:', JSON.stringify(message));

      // Broadcast to all connected clients (including sender)
      // This creates a relay effect where messages are distributed
      this.broadcast(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocketHub] Error processing message:', error);
    }
  }

  // WebSocket close handler - called when connection closes
  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    console.log(`[WebSocketHub] WebSocket closed: code=${code}, reason=${reason}, clean=${wasClean}`);
    this.connections.delete(ws);
    console.log(`[WebSocketHub] Remaining connections: ${this.connections.size}`);
  }

  // WebSocket error handler - called when error occurs
  webSocketError(ws: WebSocket, error: unknown) {
    console.error('[WebSocketHub] WebSocket error:', error);
    this.connections.delete(ws);
  }

  // Broadcast method - can be called from Worker via stub
  // This is a public method that the Worker can invoke
  broadcast(message: string): void {
    let sentCount = 0;
    for (const connection of this.connections) {
      try {
        connection.send(message);
        sentCount++;
      } catch (error) {
        console.error('[WebSocketHub] Failed to send to connection:', error);
        // Don't delete here - let webSocketError handle it
      }
    }
    console.log(`[WebSocketHub] Broadcasted to ${sentCount}/${this.connections.size} connections`);
  }
}
