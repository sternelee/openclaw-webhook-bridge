import Taro from "@tarojs/taro";

export type WebSocketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export class WebSocketService {
  private ws: any = null;
  private url: string = "";
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;
  private messageHandlers: ((data: any) => void)[] = [];
  private statusHandlers: ((status: WebSocketStatus) => void)[] = [];

  constructor(url: string = "") {
    this.url = url;
  }

  setUrl(url: string) {
    this.url = url;
  }

  onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }

  onStatusChange(handler: (status: WebSocketStatus) => void) {
    this.statusHandlers.push(handler);
  }

  private notifyStatus(status: WebSocketStatus) {
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private notifyMessage(data: any) {
    this.messageHandlers.forEach((handler) => handler(data));
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.url) {
        const error = "WebSocket URL is not configured";
        this.notifyStatus("error");
        reject(new Error(error));
        return;
      }

      if (
        this.ws &&
        (this.ws.readyState === WebSocket.CONNECTING ||
          this.ws.readyState === WebSocket.OPEN)
      ) {
        resolve();
        return;
      }

      this.notifyStatus("connecting");

      try {
        this.ws = Taro.connectSocket({
          url: this.url,
          protocols: ["echo-protocol"],
        });

        this.ws.onOpen(() => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.notifyStatus("connected");
          resolve();
        });

        this.ws.onMessage((msg: any) => {
          console.log("WebSocket message received:", msg.data);
          try {
            const data = JSON.parse(msg.data);
            this.notifyMessage(data);
          } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
            this.notifyMessage({ raw: msg.data });
          }
        });

        this.ws.onError((error: any) => {
          console.error("WebSocket error:", error);
          this.notifyStatus("error");
          reject(error);
        });

        this.ws.onClose(() => {
          console.log("WebSocket closed");
          this.notifyStatus("disconnected");
          this.ws = null;

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(
              `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
            );
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch(console.error);
            }, this.reconnectDelay);
          }
        });
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        this.notifyStatus("error");
        reject(error);
      }
    });
  }

  send(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      try {
        const message = typeof data === "string" ? data : JSON.stringify(data);
        this.ws.send({
          data: message,
          success: () => {
            console.log("Message sent:", message);
            resolve();
          },
          fail: (error: any) => {
            console.error("Failed to send message:", error);
            reject(error);
          },
        });
      } catch (error) {
        console.error("Error sending message:", error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.notifyStatus("disconnected");
  }

  getStatus(): WebSocketStatus {
    if (!this.ws) return "disconnected";

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return "disconnected";
      default:
        return "disconnected";
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

let wsService: WebSocketService | null = null;

export function getWebSocketService(url?: string): WebSocketService {
  if (!wsService) {
    wsService = new WebSocketService(url || "");
  } else if (url) {
    wsService.setUrl(url);
  }
  return wsService;
}
