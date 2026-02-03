import { observable, action, computed } from "mobx";
import Taro from "@tarojs/taro";
import type { ChatMessage } from "../types/openclaw";
import {
  getWebSocketService,
  type WebSocketStatus,
} from "../services/websocket";

const STORAGE_KEY = "openclaw_messages";
const MAX_MESSAGES = 100;

class ChatStore {
  @observable wsUrl: string = "";
  @observable messages: ChatMessage[] = [];
  @observable connecting: boolean = false;
  @observable wsStatus: WebSocketStatus = "disconnected";
  @observable sessionId: string = "";
  @observable uid: string = ""; // Bridge UID for routing
  @observable streaming: boolean = false; // AI is currently streaming response
  @observable currentStreamingMessage: string = ""; // Current streaming content

  private wsService = getWebSocketService();

  constructor() {
    this.loadMessages();
    this.loadSettings();
    this.setupWebSocketHandlers();
  }

  @computed
  get connected(): boolean {
    return this.wsStatus === "connected";
  }

  // Get grouped messages for display
  @computed
  get groupedMessages(): Array<{
    role: "user" | "assistant";
    messages: ChatMessage[];
  }> {
    if (!this.messages || this.messages.length === 0) return [];

    const groups: Array<{
      role: "user" | "assistant";
      messages: ChatMessage[];
    }> = [];

    let currentGroup: typeof groups[0] | null = null;

    this.messages.forEach((message) => {
      if (!currentGroup || currentGroup.role !== message.role) {
        currentGroup = {
          role: message.role,
          messages: [message],
        };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(message);
      }
    });

    return groups;
  }

  @action
  loadMessages = () => {
    try {
      const stored = Taro.getStorageSync(STORAGE_KEY);
      if (stored && Array.isArray(stored)) {
        this.messages = stored;
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  @action
  saveMessages = () => {
    try {
      const toSave = this.messages.slice(-MAX_MESSAGES);
      Taro.setStorageSync(STORAGE_KEY, toSave);
    } catch (error) {
      console.error("Failed to save messages:", error);
    }
  };

  @action
  loadSettings = () => {
    try {
      const settings = Taro.getStorageSync("openclaw_settings");
      if (settings) {
        this.wsUrl = settings.wsUrl || "";
        this.sessionId = settings.sessionId || "";
        this.uid = settings.uid || "";
        if (this.wsUrl) {
          this.wsService.setUrl(this.wsUrl);
        }
        if (this.uid) {
          this.wsService.setUid(this.uid);
        }
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  @action
  saveSettings = () => {
    try {
      Taro.setStorageSync("openclaw_settings", {
        wsUrl: this.wsUrl,
        sessionId: this.sessionId,
        uid: this.uid,
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  @action
  setWsUrl = (url: string) => {
    this.wsUrl = url;
    this.wsService.setUrl(url);
    this.saveSettings();
  };

  @action
  setSessionId = (id: string) => {
    this.sessionId = id;
    this.saveSettings();
  };

  @action
  setUid = (uid: string) => {
    this.uid = uid;
    this.wsService.setUid(uid);
    this.saveSettings();
  };

  @action
  connect = async () => {
    if (!this.wsUrl) {
      throw new Error("WebSocket URL is not configured");
    }

    this.connecting = true;
    try {
      await this.wsService.connect();
    } catch (error) {
      console.error("Connection failed:", error);
      throw error;
    } finally {
      this.connecting = false;
    }
  };

  @action
  disconnect = () => {
    this.wsService.disconnect();
  };

  @action
  sendMessage = async (content: string) => {
    if (!this.connected) {
      throw new Error("Not connected to server");
    }

    const message: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: Date.now(),
      status: "sending",
      read: false,
    };

    this.addMessage(message);

    try {
      await this.wsService.send({
        id: message.id,
        content,
        session: this.sessionId || undefined,
      });

      this.updateMessageStatus(message.id, "sent");
    } catch (error) {
      console.error("Failed to send message:", error);
      this.updateMessageStatus(message.id, "error");
      throw error;
    }
  };

  @action
  addMessage = (message: ChatMessage) => {
    this.messages.push(message);
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }
    this.saveMessages();
  };

  @action
  updateMessageStatus = (
    id: string,
    status: "sending" | "sent" | "error" | "streaming"
  ) => {
    const message = this.messages.find((m) => m.id === id);
    if (message) {
      message.status = status;
      this.saveMessages();
    }
  };

  @action
  updateMessageContent = (id: string, content: string) => {
    const message = this.messages.find((m) => m.id === id);
    if (message) {
      message.content = content;
      this.saveMessages();
    }
  };

  @action
  setMessageRead = (id: string) => {
    const message = this.messages.find((m) => m.id === id);
    if (message && message.role === "user") {
      message.read = true;
      this.saveMessages();
    }
  };

  @action
  setAllMessagesRead = () => {
    this.messages.forEach((message) => {
      if (message.role === "user") {
        message.read = true;
      }
    });
    this.saveMessages();
  };

  @action
  clearMessages = () => {
    this.messages = [];
    try {
      Taro.removeStorageSync(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear messages:", error);
    }
  };

  @action
  private setStreaming = (streaming: boolean) => {
    this.streaming = streaming;
  };

  @action
  private setCurrentStreamingMessage = (content: string) => {
    this.currentStreamingMessage = content;
  };

  private setupWebSocketHandlers() {
    this.wsService.onStatusChange((status: WebSocketStatus) => {
      this.wsStatus = status;
    });

    this.wsService.onMessage((data: any) => {
      console.log("Received message:", data);

      if (data.type === "progress") {
        // Streaming response in progress
        this.setStreaming(true);
        this.setCurrentStreamingMessage(data.content);

        // Update or create streaming message
        const streamingId = `stream_${this.sessionId || "default"}`;
        const existingMessage = this.messages.find((m) => m.id === streamingId);

        if (existingMessage) {
          // Update existing streaming message
          existingMessage.content = data.content;
          existingMessage.status = "streaming";
        } else {
          // Create new streaming message
          const assistantMessage: ChatMessage = {
            id: streamingId,
            content: data.content,
            role: "assistant",
            timestamp: Date.now(),
            status: "streaming",
          };
          this.addMessage(assistantMessage);
        }

        // Mark user messages as read when we receive a response
        this.setAllMessagesRead();

        if (data.session && !this.sessionId) {
          this.setSessionId(data.session);
        }
      } else if (data.type === "complete") {
        // Streaming response complete
        this.setStreaming(false);

        const streamingId = `stream_${this.sessionId || "default"}`;
        const existingMessage = this.messages.find((m) => m.id === streamingId);

        if (existingMessage) {
          // Update existing message with final content
          existingMessage.content = data.content;
          existingMessage.status = "sent";
        } else {
          // Create completed message
          const assistantMessage: ChatMessage = {
            id: `resp_${Date.now()}`,
            content: data.content,
            role: "assistant",
            timestamp: Date.now(),
            status: "sent",
          };
          this.addMessage(assistantMessage);
        }

        if (data.session && !this.sessionId) {
          this.setSessionId(data.session);
        }
      } else if (data.type === "error") {
        // Error response
        this.setStreaming(false);
        this.setCurrentStreamingMessage("");

        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          content: `Error: ${data.error || "Unknown error"}`,
          role: "assistant",
          timestamp: Date.now(),
          status: "sent",
        };
        this.addMessage(errorMessage);

        // Mark user messages as read on error too
        this.setAllMessagesRead();
      }
    });
  }
}

export default new ChatStore();
