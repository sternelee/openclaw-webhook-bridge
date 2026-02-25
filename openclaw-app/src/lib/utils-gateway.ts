/**
 * Gateway WebSocket client for OpenClaw communication.
 * Also supports Webhook simple message format for bridge mode.
 */

import type {
  GatewayClientOptions,
  GatewayEventFrame,
  GatewayHelloOk,
  GatewayRequestFrame,
  GatewayResponseFrame,
} from "@/types";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

// 4008 = application-defined code (browser rejects 1008 "Policy Violation")
const CONNECT_FAILED_CLOSE_CODE = 4008;

/** Webhook simple message format */
export interface WebhookMessage {
  id: string;
  content: string;
  sender_id?: string;
  session?: string;
  peerKind?: string;
  peerId?: string;
  chatType?: string;
  chatId?: string;
  senderId?: string;
}

/** Bridge response format */
export interface BridgeResponseBase {
  session?: string;
}

export interface BridgeProgressResponse extends BridgeResponseBase {
  type: "progress";
  content: string;
}

export interface BridgeCompleteResponse extends BridgeResponseBase {
  type: "complete";
  content: string;
}

export interface BridgeErrorResponse extends BridgeResponseBase {
  type: "error";
  content: string; // Error message
}

export type BridgeResponse = BridgeProgressResponse | BridgeCompleteResponse | BridgeErrorResponse;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private _connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: number | null = null;
  private backoffMs = 800;

  constructor(private opts: GatewayClientOptions) {}

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    // Clear any pending connection timers
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("gateway client stopped"));
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect() {
    if (this.closed) return;
    const url = this.opts.uid ? `${this.opts.url}?uid=${encodeURIComponent(this.opts.uid)}` : this.opts.url;
    this.ws = new WebSocket(url);
    this.ws.addEventListener("open", () => this.queueConnect());
    this.ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data ?? "")));
    this.ws.addEventListener("close", (ev) => {
      const reason = String(ev.reason ?? "");
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason });
      this.scheduleReconnect();
    });
    this.ws.addEventListener("error", () => {
      // ignored; close handler will fire
    });
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    window.setTimeout(() => this.connect(), delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private async sendConnect() {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    // In Webhook mode, skip Gateway protocol handshake
    if (this.opts.useWebhookMode) {
      this.backoffMs = 800;
      // Simulate a hello response for compatibility
      const mockHello: GatewayHelloOk = {
        type: "hello-ok",
        protocol: 3,
        features: { methods: [], events: ["agent.delta", "agent.final", "agent.error"] },
      };
      this.opts.onHello?.(mockHello);
      return;
    }

    const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];
    const role = "operator";
    const auth =
      this.opts.token || this.opts.password
        ? {
            token: this.opts.token,
            password: this.opts.password,
          }
        : undefined;

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.opts.clientName ?? "openclaw-webchat",
        version: this.opts.clientVersion ?? "dev",
        platform: this.opts.platform ?? typeof navigator !== "undefined" ? navigator.platform ?? "web" : "web",
        mode: this.opts.mode ?? "webchat",
        instanceId: this.opts.instanceId,
      },
      role,
      scopes,
      auth,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      locale: typeof navigator !== "undefined" ? navigator.language : "en",
    };

    void this.request<GatewayHelloOk>("connect", params)
      .then((hello) => {
        this.backoffMs = 800;
        this.opts.onHello?.(hello);
      })
      .catch(() => {
        this.ws?.close(CONNECT_FAILED_CLOSE_CODE, "connect failed");
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };

    // Handle Bridge response format (progress/complete/error)
    if (frame.type === "progress" || frame.type === "complete" || frame.type === "error") {
      const bridgeRes = parsed as BridgeResponse;
      console.log("[gateway] Bridge response:", bridgeRes);
      
      // Convert Bridge response to Gateway event format for compatibility
      if (bridgeRes.type === "progress" || bridgeRes.type === "complete") {
        // For progress/complete, send as agent.delta (streaming)
        const evt: GatewayEventFrame = {
          type: "event",
          event: "agent.delta",
          payload: {
            content: bridgeRes.content, // Use 'content', not 'text'
            sessionKey: bridgeRes.session,
          },
        };
        try {
          this.opts.onEvent?.(evt);
        } catch (err) {
          console.error("[gateway] bridge response handler error:", err);
        }
        
        // If complete, also send final event to stop streaming
        if (bridgeRes.type === "complete") {
          const finalEvt: GatewayEventFrame = {
            type: "event",
            event: "agent.final",
            payload: {
              message: {
                role: "assistant",
                content: bridgeRes.content,
                timestamp: Date.now(),
              },
              sessionKey: bridgeRes.session,
            },
          };
          try {
            this.opts.onEvent?.(finalEvt);
          } catch (err) {
            console.error("[gateway] bridge final handler error:", err);
          }
        }
      } else if (bridgeRes.type === "error") {
        const evt: GatewayEventFrame = {
          type: "event",
          event: "agent.abort",
          payload: {
            error: bridgeRes.content,
            sessionKey: bridgeRes.session,
          },
        };
        try {
          this.opts.onEvent?.(evt);
        } catch (err) {
          console.error("[gateway] bridge error handler error:", err);
        }
      }
      return;
    }

    // Handle Gateway protocol
    if (frame.type === "event") {
      const evt = parsed as GatewayEventFrame;
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (nonce) {
          this._connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }
      try {
        this.opts.onEvent?.(evt);
      } catch (err) {
        console.error("[gateway] event handler error:", err);
      }
      return;
    }

    if (frame.type === "res") {
      const res = parsed as GatewayResponseFrame;
      console.log("[gateway] Received response:", res.id, res.ok ? "ok" : "error");

      // Also emit as event for UI display (e.g., tool call results)
      const resEvent: GatewayEventFrame = {
        type: "event",
        event: "gateway.response",
        payload: {
          id: res.id,
          ok: res.ok,
          payload: res.payload,
          error: res.error,
        },
      };
      try {
        this.opts.onEvent?.(resEvent);
      } catch (err) {
        console.error("[gateway] response event handler error:", err);
      }

      const pending = this.pending.get(res.id);
      if (!pending) {
        console.warn("[gateway] No pending request for response id:", res.id);
        return;
      }
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(new Error(res.error?.message ?? "request failed"));
      }
      return;
    }
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = generateUUID();
    const frame: GatewayRequestFrame = { type: "req", id, method, params };
    console.log("[gateway] Sending request:", method, id);
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }

  /**
   * Send message in Webhook simple format (for bridge mode)
   * This bypasses the Gateway protocol and sends raw message to bridge
   */
  sendWebhookMessage(msg: WebhookMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[gateway] Cannot send: not connected");
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  private queueConnect() {
    this._connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
    }
    this.connectTimer = window.setTimeout(() => {
      void this.sendConnect();
    }, 750);
  }
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
