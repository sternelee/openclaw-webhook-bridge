export type WebhookMessageHandler = (data: string) => Promise<void> | void;

export class WebhookClient {
  private socket: WebSocket | null = null;
  private connected = false;
  private abortController: AbortController | null = null;
  private reconnectDelayMs = 2000;

  constructor(
    private readonly url: string,
    private readonly handler: WebhookMessageHandler,
    private readonly uid: string,
  ) {}

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

  async send(data: string): Promise<void> {
    if (!this.socket || !this.connected) {
      throw new Error("Webhook not connected");
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
    throw new Error("Timeout connecting to webhook server");
  }

  private async startLoop(signal: AbortSignal): Promise<void> {
    let delay = this.reconnectDelayMs;
    while (!signal.aborted) {
      try {
        await this.connectOnce(signal);
        delay = this.reconnectDelayMs;
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        await sleep(delay);
        delay = Math.min(delay * 2, 30000);
      }
    }
  }

  private async connectOnce(signal: AbortSignal): Promise<void> {
    const url = this.uid ? appendUid(this.url, this.uid) : this.url;
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
      };

      const onMessage = (event: MessageEvent) => {
        const data =
          typeof event.data === "string" ? event.data : String(event.data);
        Promise.resolve(this.handler(data)).catch((error) => {
          console.error("[Webhook] Handler error:", error);
        });
      };

      const onError = () => {
        if (!settled) {
          settled = true;
          cleanup();
          this.connected = false;
          reject(new Error("Webhook connection error"));
        }
      };

      const onClose = () => {
        if (!settled) {
          settled = true;
          cleanup();
          this.connected = false;
          reject(new Error("Webhook connection closed"));
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
          reject(new Error("Webhook connection timeout"));
        }
      };

      void checkOpen();
    });
  }
}

function appendUid(url: string, uid: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}uid=${encodeURIComponent(uid)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
