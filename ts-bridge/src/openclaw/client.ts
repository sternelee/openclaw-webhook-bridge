export type OpenClawEventHandler = (data: string) => Promise<void> | void;

export class OpenClawClient {
  private socket: WebSocket | null = null;
  private connected = false;
  private abortController: AbortController | null = null;

  constructor(
    private readonly port: number,
    private readonly token: string,
    private readonly agentId: string,
  ) {}

  setEventHandler(handler: OpenClawEventHandler): void {
    this.onEvent = handler;
  }

  private onEvent: OpenClawEventHandler | null = null;

  async connect(): Promise<void> {
    this.abortController = new AbortController();
    this.startLoop(this.abortController.signal);
    await this.waitForConnection();
  }

  async close(): Promise<void> {
    this.abortController?.abort();
    this.socket?.close();
    this.connected = false;
  }

  async sendAgentRequest(message: string, sessionKey: string): Promise<void> {
    const payload = {
      type: "req",
      id: `agent:${Date.now()}`,
      method: "agent",
      params: {
        message,
        agentId: this.agentId,
        sessionKey,
        deliver: true,
        idempotencyKey: `${Date.now()}`,
      },
    };
    await this.sendRaw(JSON.stringify(payload));
  }

  async sendRaw(data: string): Promise<void> {
    for (let i = 0; i < 100; i += 1) {
      if (this.connected) {
        break;
      }
      await sleep(50);
    }
    if (!this.connected || !this.socket) {
      throw new Error("OpenClaw gateway not connected");
    }
    this.socket.send(data);
  }

  private async waitForConnection(): Promise<void> {
    for (let i = 0; i < 50; i += 1) {
      if (this.connected) {
        return;
      }
      await sleep(100);
    }
    throw new Error("Timeout connecting to OpenClaw gateway");
  }

  private async startLoop(signal: AbortSignal): Promise<void> {
    let delay = 1000;
    while (!signal.aborted) {
      try {
        await this.connectOnce(signal);
        delay = 1000;
      } catch {
        if (signal.aborted) {
          return;
        }
        await sleep(delay);
        delay = Math.min(delay * 2, 30000);
      }
    }
  }

  private async connectOnce(signal: AbortSignal): Promise<void> {
    const url = `ws://127.0.0.1:${this.port}`;
    return new Promise((_, reject) => {
      const socket = new WebSocket(url);
      let settled = false;

      const cleanup = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };

      const onOpen = () => {
        this.socket = socket;
        this.connected = true;
        socket.send(JSON.stringify(connectPayload(this.token)));
      };

      const onMessage = (event: MessageEvent) => {
        const data =
          typeof event.data === "string" ? event.data : String(event.data);
        if (this.onEvent) {
          Promise.resolve(this.onEvent(data)).catch((error) => {
            console.error("[OpenClaw] Event handler error:", error);
          });
        }
      };

      const onError = () => {
        if (!settled) {
          settled = true;
          cleanup();
          this.connected = false;
          reject(new Error("OpenClaw connection error"));
        }
      };

      const onClose = () => {
        if (!settled) {
          settled = true;
          cleanup();
          this.connected = false;
          reject(new Error("OpenClaw connection closed"));
        }
      };

      socket.addEventListener("open", onOpen);
      socket.addEventListener("message", onMessage);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);

      const checkOpen = async () => {
        for (let i = 0; i < 50; i += 1) {
          if (signal.aborted) {
            socket.close();
            return;
          }
          if (this.connected) {
            return;
          }
          await sleep(100);
        }
        socket.close();
        if (!settled) {
          settled = true;
          cleanup();
          this.connected = false;
          reject(new Error("OpenClaw connection timeout"));
        }
      };

      void checkOpen();
    });
  }
}

function connectPayload(token: string): Record<string, unknown> {
  return {
    type: "req",
    id: "connect",
    method: "connect",
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "gateway-client",
        version: "0.2.0",
        platform: "bun",
        mode: "backend",
      },
      role: "operator",
      scopes: ["operator.read", "operator.write", "operator.admin"],
      auth: {
        token,
      },
      locale: "zh-CN",
      userAgent: "openclaw-bridge-bun",
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
