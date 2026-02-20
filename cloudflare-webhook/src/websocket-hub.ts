// Type definition for Cloudflare Workers environment
export interface Env {
  WEBSOCKET_HUB: DurableObjectNamespace;
}

// Durable Object for managing WebSocket connections
// Uses in-memory state for connection tracking (works with hibernation)
export class WebSocketHub {
  // Map of UID -> Set of connections for that UID
  private connectionsByUID: Map<string, Set<WebSocket>> = new Map();
  // Reverse lookup for WebSocket -> UID
  private uidByConnection: Map<WebSocket, string> = new Map();
  // Track connection timestamps in memory (for heartbeat)
  private connectionTimestamps: Map<WebSocket, number> = new Map();

  // Configuration constants
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT_MS = 120000; // 2 minutes
  private readonly MAX_CONNECTIONS_PER_UID = 10;
  private readonly GLOBAL_MAX_CONNECTIONS = 1000;

  constructor(
    readonly state: DurableObjectState,
    readonly env: Env,
  ) {
    // Start heartbeat interval
    this.startHeartbeat();
  }

  // Start heartbeat interval to detect dead connections
  private startHeartbeat(): void {
    setInterval(() => {
      this.cleanupDeadConnections();
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  // Cleanup connections that haven't responded to ping
  private cleanupDeadConnections(): void {
    const now = Date.now();
    const deadConnections: WebSocket[] = [];

    for (const [ws] of this.uidByConnection.entries()) {
      const connectedAt = this.connectionTimestamps.get(ws);
      if (connectedAt && now - connectedAt > this.HEARTBEAT_TIMEOUT_MS) {
        deadConnections.push(ws);
      }
    }

    for (const ws of deadConnections) {
      console.log("[WebSocketHub] Cleaning up dead connection");
      try {
        ws.close(1000, "Connection timeout");
      } catch {}
      this.removeFromConnections(ws);
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
      this.connectionTimestamps.delete(ws);
    }
  }

  // Fetch method - main communication layer between Worker and Durable Object
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade");

    // Handle WebSocket upgrade
    if (upgradeHeader === "websocket") {
      return this.handleWebSocketUpgrade(url);
    }

    // Handle broadcast API endpoint
    if (url.pathname === "/broadcast" && request.method === "POST") {
      return this.handleBroadcast(request);
    }

    // Handle stats endpoint (includes health check data)
    if (url.pathname === "/stats") {
      return this.handleStats();
    }

    return new Response("Not found", { status: 404 });
  }

  // Handle WebSocket upgrade requests
  private handleWebSocketUpgrade(url: URL): Response {
    // Extract UID from query parameter or path
    let uid = url.searchParams.get("uid") || "";

    // Also check path pattern /ws/:uid
    const pathMatch = url.pathname.match(/^\/ws\/([^\/]+)$/);
    if (pathMatch) {
      uid = pathMatch[1];
    }

    // UID is REQUIRED - reject connections without UID
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

    // Check connection limits
    const currentConnections = this.connectionsByUID.get(uid)?.size || 0;
    if (currentConnections >= this.MAX_CONNECTIONS_PER_UID) {
      console.error(
        `[WebSocketHub] Rejected connection: UID=${uid} has too many connections (${currentConnections})`,
      );
      return new Response(
        JSON.stringify({ error: "Too many connections for this UID" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    const totalConnections = this.uidByConnection.size;
    if (totalConnections >= this.GLOBAL_MAX_CONNECTIONS) {
      console.error(
        `[WebSocketHub] Rejected connection: global connection limit reached (${totalConnections})`,
      );
      return new Response(
        JSON.stringify({ error: "Server connection limit reached" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // Create WebSocket pair
    const websocketPair = new WebSocketPair();
    const [client, server] = Object.values(websocketPair);

    // Use acceptWebSocket() for hibernation support
    // Note: In-memory state persists across hibernation in Cloudflare Workers
    this.state.acceptWebSocket(server);

    // Store connection metadata in memory
    const now = Date.now();
    this.connectionTimestamps.set(server, now);

    // Map it to the UID for routing
    this.addToConnections(server, uid);

    console.log(
      `[WebSocketHub] New connection: UID=${uid}, total=${this.uidByConnection.size}`,
    );

    // Return the client socket to establish the connection
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Handle broadcast API endpoint
  private async handleBroadcast(request: Request): Promise<Response> {
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

      // Fallback: broadcast to all
      const msgStr = JSON.stringify(body);
      const sentCount = this.broadcastToAll(msgStr);
      return Response.json({
        success: true,
        sentTo: sentCount,
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
  private handleStats(): Response {
    const connectionsByUID: Record<string, number> = {};
    for (const [uid, connections] of this.connectionsByUID.entries()) {
      connectionsByUID[uid] = connections.size;
    }

    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      activeConnections: this.uidByConnection.size,
      connectionsByUID,
    });
  }

  // WebSocket message handler
  webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    try {
      const uid = this.uidByConnection.get(ws);
      const messageStr = data as string;

      // Update last ping timestamp in memory
      this.connectionTimestamps.set(ws, Date.now());

      // Log message type for debugging
      try {
        const json = JSON.parse(messageStr);
        const connectionsCount =
          this.connectionsByUID.get(uid || "")?.size || 0;
        console.log(
          `[WebSocketHub] Message from UID=${uid}: type=${
            json.type || json.event || "unknown"
          }, connections: ${connectionsCount}`,
        );
      } catch {
        console.log(`[WebSocketHub] Message from UID=${uid}: (non-JSON)`);
      }

      // Broadcast to all connected clients with the SAME UID (no echo to sender)
      if (uid) {
        const sentCount = this.broadcastToUIDExcept(uid, messageStr, ws);
        console.log(
          `[WebSocketHub] Broadcast to UID=${uid}: ${sentCount} connections`,
        );
      }
    } catch (error) {
      console.error("[WebSocketHub] Error processing message:", error);
    }
  }

  // WebSocket close handler
  webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ) {
    console.log("[WebSocketHub] Connection closed");
    this.removeFromConnections(_ws);
  }

  // WebSocket error handler
  webSocketError(ws: WebSocket, error: unknown) {
    const uid = this.uidByConnection.get(ws);
    console.error(`[WebSocketHub] WebSocket error for UID=${uid}:`, error);
    this.removeFromConnections(ws);
  }

  // Broadcast to all connections
  private broadcastToAll(message: string): number {
    let sentCount = 0;
    for (const connection of this.uidByConnection.keys()) {
      try {
        connection.send(message);
        sentCount++;
      } catch (error) {
        console.error("[WebSocketHub] Failed to send:", error);
        this.removeFromConnections(connection);
      }
    }
    return sentCount;
  }

  // Broadcast to all connections with a specific UID
  private broadcastToUID(uid: string, message: string): number {
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
        console.error(`[WebSocketHub] Failed to send to UID=${uid}:`, error);
        this.removeFromConnections(connection);
      }
    }
    return sentCount;
  }

  // Broadcast to all connections with a specific UID except one (avoid echo)
  private broadcastToUIDExcept(
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
        console.error(`[WebSocketHub] Failed to send to UID=${uid}:`, error);
        this.removeFromConnections(connection);
      }
    }
    return sentCount;
  }
}
