import Taro from "@tarojs/taro";

export type WebSocketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export class WebSocketService {
  private ws: any = null;
  private url: string = "";
  private uid: string = ""; // UID for routing
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;
  private messageHandlers: ((data: any) => void)[] = [];
  private statusHandlers: ((status: WebSocketStatus) => void)[] = [];
  private connectionState: WebSocketStatus = "disconnected";
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: any) => void) | null = null;

  constructor(url: string = "") {
    this.url = url;
  }

  setUrl(url: string) {
    this.url = url;
  }

  setUid(uid: string) {
    this.uid = uid;
  }

  // Get the URL with UID query parameter appended
  private getUrlWithUid(): string {
    if (!this.uid) {
      return this.url;
    }
    const separator = this.url.includes("?") ? "&" : "?";
    return `${this.url}${separator}uid=${encodeURIComponent(this.uid)}`;
  }

  onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }

  onStatusChange(handler: (status: WebSocketStatus) => void) {
    this.statusHandlers.push(handler);
  }

  private notifyStatus(status: WebSocketStatus) {
    this.connectionState = status;
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
        this.connectionState === "connected" ||
        this.connectionState === "connecting"
      ) {
        if (this.connectionState === "connected") {
          resolve();
        } else {
          // Already connecting, store the resolve/reject for when current connection completes
          this.connectResolve = resolve;
          this.connectReject = reject;
        }
        return;
      }

      this.connectResolve = resolve;
      this.connectReject = reject;
      this.notifyStatus("connecting");

      try {
        this.ws = Taro.connectSocket({
          url: this.getUrlWithUid(),
        });

        // Use Taro's global event handlers for WeChat mini-program
        Taro.onSocketOpen(() => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.notifyStatus("connected");
          if (this.connectResolve) {
            this.connectResolve();
            this.connectResolve = null;
            this.connectReject = null;
          }
        });

        Taro.onSocketMessage((msg: any) => {
          // console.log("WebSocket message received:", msg.data);
          try {
            const data = JSON.parse(msg.data);
            this.notifyMessage(data);
          } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
            this.notifyMessage({ raw: msg.data });
          }
        });

        Taro.onSocketError((error: any) => {
          console.error("WebSocket error:", error);
          this.notifyStatus("error");
          if (this.connectReject) {
            this.connectReject(error);
            this.connectResolve = null;
            this.connectReject = null;
          }
        });

        Taro.onSocketClose(() => {
          console.log("WebSocket closed");
          const wasConnected = this.connectionState === "connected";
          this.notifyStatus("disconnected");
          this.ws = null;

          if (this.connectReject && !wasConnected) {
            this.connectReject(
              new Error("Connection closed before established"),
            );
            this.connectResolve = null;
            this.connectReject = null;
          }

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            // console.log(
            //   `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
            // );
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch(console.error);
            }, this.reconnectDelay);
          }
        });
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        this.notifyStatus("error");
        if (this.connectReject) {
          this.connectReject(error);
          this.connectResolve = null;
          this.connectReject = null;
        }
      }
    });
  }

  send(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connectionState !== "connected") {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      try {
        const message = typeof data === "string" ? data : JSON.stringify(data);
        Taro.sendSocketMessage({
          data: message,
          success: () => {
            // console.log("Message sent:", message);
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
      Taro.closeSocket();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.notifyStatus("disconnected");
  }

  getStatus(): WebSocketStatus {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === "connected";
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
