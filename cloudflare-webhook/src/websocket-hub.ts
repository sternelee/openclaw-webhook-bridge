// Type definition for Cloudflare Workers environment
export interface Env {
  WEBSOCKET_HUB: DurableObjectNamespace;
}

// Durable Object for managing WebSocket connections
// Following the Fiberplane pattern for Hono + Durable Objects + WebSocket Hibernation
export class WebSocketHub {
  // Map of UID -> Set of connections for that UID
  connectionsByUID: Map<string, Set<WebSocket>> = new Map();
  // Also maintain a reverse lookup for WebSocket -> UID
  uidByConnection: Map<WebSocket, string> = new Map();
  // Storage for the Durable Object state (WebSocket hibernation API)
  readonly #state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.#state = state;

    // IMPORTANT: Restore WebSocket connections after hibernation
    // getWebSockets() returns the server sockets that were passed to acceptWebSocket()
    const websockets = this.#state.getWebSockets();
    for (const ws of websockets) {
      // After hibernation, we lose UID mapping since it's stored in memory
      // Re-connect without UID - client will need to reconnect with proper UID
      this.addToConnections(ws, "hibernated");
    }
    // Only log if there are actual connections
    const totalConnections = this.uidByConnection.size;
    if (totalConnections > 0) {
      console.log(
        `[WebSocketHub] Awake from hibernation, connections: ${totalConnections}`,
      );
    }
  }

  // Add connection to the appropriate UID bucket
  private addToConnections(ws: WebSocket, uid: string): void {
    if (!this.connectionsByUID.has(uid)) {
      this.connectionsByUID.set(uid, new Set());
    }
    this.connectionsByUID.get(uid)!.add(ws);
    this.uidByConnection.set(ws, uid);
  }

  // Remove connection from UID buckets
  private removeFromConnections(ws: WebSocket): void {
    const uid = this.uidByConnection.get(ws);
    if (uid) {
      const connections = this.connectionsByUID.get(uid);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          this.connectionsByUID.delete(uid);
        }
      }
      this.uidByConnection.delete(ws);
    }
  }

  // Fetch method - main communication layer between Worker and Durable Object
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade");

    // Handle WebSocket upgrade
    if (upgradeHeader === "websocket") {
      // Extract UID from query parameter or path
      // Support both: /ws?uid=xxx and /ws/xxx
      let uid = url.searchParams.get("uid") || "";

      // Also check path pattern /ws/:uid
      const pathMatch = url.pathname.match(/^\/ws\/([^\/]+)$/);
      if (pathMatch) {
        uid = pathMatch[1];
      }

      // UID is now REQUIRED - reject connections without UID
      if (!uid) {
        console.error("[WebSocketHub] Rejected connection: UID is required");
        return new Response(
          JSON.stringify({
            error:
              "UID is required. Connect with /ws?uid=YOUR_UID or /ws/YOUR_UID",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // UID connection accepted (no logging for privacy)

      // Create WebSocket pair
      const websocketPair = new WebSocketPair();
      const [client, server] = Object.values(websocketPair);

      // IMPORTANT: Use acceptWebSocket() for hibernation support
      // This allows the Durable Object to hibernate and save memory when inactive
      this.#state.acceptWebSocket(server);

      // Store the SERVER socket (not client) for broadcasting
      // Map it to the UID for routing
      this.addToConnections(server, uid);

      // Return the client socket to establish the connection
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Handle broadcast API endpoint
    // POST /broadcast with { uid, data } to broadcast to specific UID
    if (url.pathname === "/broadcast" && request.method === "POST") {
      try {
        const body = (await request.json()) as Record<string, unknown>;
        const uid = body.uid as string;
        const message = body.data;

        if (uid && message) {
          const sentCount = this.broadcastToUID(uid, JSON.stringify(message));
          return Response.json({
            success: true,
            sentTo: sentCount,
            uid,
          });
        }

        // Fallback: broadcast to all (backward compatibility)
        const msgStr = JSON.stringify(body);
        this.broadcast(msgStr);
        return Response.json({
          success: true,
          sentTo: this.uidByConnection.size,
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 400 },
        );
      }
    }

    // Handle stats endpoint
    if (url.pathname === "/stats") {
      // Count connections per UID
      const connectionsByUID: Record<string, number> = {};
      for (const [uid, connections] of this.connectionsByUID.entries()) {
        connectionsByUID[uid] = connections.size;
      }

      return Response.json({
        activeConnections: this.uidByConnection.size,
        connectionsByUID,
      });
    }

    // Handle health endpoint
    if (url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        activeConnections: this.uidByConnection.size,
      });
    }

    return new Response("Not found", { status: 404 });
  }

  // WebSocket message handler - called when client sends a message
  // Cloudflare calls this with the server socket (the one passed to acceptWebSocket)
  webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    try {
      const uid = this.uidByConnection.get(ws);

      // Broadcast to all connected clients with the SAME UID (no echo to sender)
      if (uid) {
        this.broadcastToUIDExcept(uid, data as string, ws);
      } else {
        // Fallback for hibernated connections without UID
        this.broadcastExcept(data as string, ws);
      }
    } catch (error) {
      console.error("[WebSocketHub] Error processing message:", error);
    }
  }

  // WebSocket close handler - called when connection closes
  webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ) {
    // Don't log close reason for privacy (may contain sensitive info)
    this.removeFromConnections(ws);
  }

  // WebSocket error handler - called when error occurs
  webSocketError(ws: WebSocket, error: unknown) {
    const uid = this.uidByConnection.get(ws);
    console.error(`[WebSocketHub] WebSocket error for UID=${uid}:`, error);
    this.removeFromConnections(ws);
  }

  // Broadcast method - can be called from Worker via stub
  // This is a public method that the Worker can invoke
  broadcast(message: string): void {
    let sentCount = 0;
    for (const connection of this.uidByConnection.keys()) {
      try {
        connection.send(message);
        sentCount++;
      } catch (error) {
        console.error("[WebSocketHub] Failed to send to connection:", error);
        // Don't delete here - let webSocketError handle it
      }
    }
  }

  // Broadcast to all clients except one (used to avoid echoing back to sender)
  broadcastExcept(message: string, excludeWs: WebSocket): void {
    for (const connection of this.uidByConnection.keys()) {
      // Skip the sender socket to avoid echo
      if (connection === excludeWs) {
        continue;
      }
      try {
        connection.send(message);
      } catch (error) {
        console.error("[WebSocketHub] Failed to send to connection:", error);
      }
    }
  }

  // Broadcast to all connections with a specific UID
  broadcastToUID(uid: string, message: string): number {
    const connections = this.connectionsByUID.get(uid);
    if (!connections) {
      return 0;
    }

    let sentCount = 0;
    for (const connection of connections) {
      try {
        connection.send(message);
        sentCount++;
      } catch (error) {
        console.error(
          `[WebSocketHub] Failed to send to connection for UID=${uid}:`,
          error,
        );
      }
    }
    return sentCount;
  }

  // Broadcast to all connections with a specific UID except one (avoid echo)
  broadcastToUIDExcept(
    uid: string,
    message: string,
    excludeWs: WebSocket,
  ): number {
    const connections = this.connectionsByUID.get(uid);
    if (!connections) {
      return 0;
    }

    let sentCount = 0;
    for (const connection of connections) {
      if (connection === excludeWs) {
        continue;
      }
      try {
        connection.send(message);
        sentCount++;
      } catch (error) {
        console.error(
          `[WebSocketHub] Failed to send to connection for UID=${uid}:`,
          error,
        );
      }
    }
    return sentCount;
  }
}
