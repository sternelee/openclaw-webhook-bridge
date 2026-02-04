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
  @observable peerKind: "dm" | "group" | "channel" | "" = "";
  @observable peerId: string = "";
  @observable topicId: string = "";
  @observable threadId: string = "";
  @observable sessions: Array<{ id: string; updatedAt: number }> = [];
  @observable sessionsLoading: boolean = false;

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

  @computed
  get sessionList(): Array<{ id: string; updatedAt: number }> {
    return this.sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  @computed
  get visibleMessages(): ChatMessage[] {
    const active = this.sessionId?.trim();
    if (!active) {
      return this.messages;
    }
    return this.messages.filter((message) => (message.session || "") === active);
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
      this.rebuildSessionsFromMessages();
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
        this.peerKind = settings.peerKind || "";
        this.peerId = settings.peerId || "";
        this.topicId = settings.topicId || "";
        this.threadId = settings.threadId || "";
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
        peerKind: this.peerKind,
        peerId: this.peerId,
        topicId: this.topicId,
        threadId: this.threadId,
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
    if (id) {
      this.touchSession(id);
    }
    this.saveSettings();
  };

  @action
  setUid = (uid: string) => {
    this.uid = uid;
    this.wsService.setUid(uid);
    this.saveSettings();
  };

  @action
  setPeerKind = (peerKind: string) => {
    const normalized = peerKind.trim().toLowerCase();
    if (normalized === "dm" || normalized === "group" || normalized === "channel") {
      this.peerKind = normalized;
    } else {
      this.peerKind = "";
    }
    this.saveSettings();
  };

  @action
  setPeerId = (peerId: string) => {
    this.peerId = peerId;
    this.saveSettings();
  };

  @action
  setTopicId = (topicId: string) => {
    this.topicId = topicId;
    this.saveSettings();
  };

  @action
  setThreadId = (threadId: string) => {
    this.threadId = threadId;
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
  requestSessionList = async () => {
    if (!this.connected) {
      return;
    }
    this.sessionsLoading = true;
    try {
      await this.wsService.send({ type: "session.list" });
    } catch (error) {
      console.error("Failed to request session list:", error);
      this.sessionsLoading = false;
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

    const activeSession = this.sessionId || "";
    const message: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: Date.now(),
      status: "sending",
      read: false,
      session: activeSession,
    };

    this.addMessage(message);

    try {
      await this.wsService.send({
        id: message.id,
        content,
        session: activeSession || undefined,
        peerKind: this.peerKind || undefined,
        peerId: this.peerId || undefined,
        topicId: this.topicId || undefined,
        threadId: this.threadId || undefined,
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
    if (message.session) {
      this.touchSession(message.session);
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
    this.sessions = [];
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
        const sessionKey = data.session || this.sessionId || "default";
        this.touchSession(sessionKey);
        // Streaming response in progress
        this.setStreaming(true);
        this.setCurrentStreamingMessage(data.content);

        // Update or create streaming message
        const streamingId = `stream_${sessionKey}`;
        const existingMessage = this.messages.find((m) => m.id === streamingId);

        if (existingMessage) {
          // Update existing streaming message
          existingMessage.content = data.content;
          existingMessage.status = "streaming";
          existingMessage.session = sessionKey;
        } else {
          // Create new streaming message
          const assistantMessage: ChatMessage = {
            id: streamingId,
            content: data.content,
            role: "assistant",
            timestamp: Date.now(),
            status: "streaming",
            session: sessionKey,
          };
          this.addMessage(assistantMessage);
        }

        // Mark user messages as read when we receive a response
        this.setAllMessagesRead();

        if (data.session && !this.sessionId) {
          this.setSessionId(data.session);
        }
      } else if (data.type === "complete") {
        const sessionKey = data.session || this.sessionId || "default";
        this.touchSession(sessionKey);
        // Streaming response complete
        this.setStreaming(false);

        const streamingId = `stream_${sessionKey}`;
        const existingMessage = this.messages.find((m) => m.id === streamingId);

        if (existingMessage) {
          // Update existing message with final content
          existingMessage.content = data.content;
          existingMessage.status = "sent";
          existingMessage.session = sessionKey;
        } else {
          // Create completed message
          const assistantMessage: ChatMessage = {
            id: `resp_${Date.now()}`,
            content: data.content,
            role: "assistant",
            timestamp: Date.now(),
            status: "sent",
            session: sessionKey,
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
          session: this.sessionId || "",
        };
        this.addMessage(errorMessage);

        // Mark user messages as read on error too
        this.setAllMessagesRead();
      } else if (data.type === "session.list") {
        const sessions = Array.isArray(data?.data?.sessions)
          ? data.data.sessions
          : [];
        const list = sessions
          .map((entry: any) => ({
            id: entry?.key || "",
            updatedAt: typeof entry?.updatedAt === "number" ? entry.updatedAt : 0,
          }))
          .filter((entry: { id: string }) => Boolean(entry.id));
        if (list.length > 0) {
          this.sessions = list;
          if (!this.sessionId) {
            this.setSessionId(list[0].id);
          }
        } else if (this.sessions.length === 0) {
          this.rebuildSessionsFromMessages();
        }
        this.sessionsLoading = false;
      }
    });
  }

  @action
  private touchSession = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      return;
    }
    const now = Date.now();
    const existing = this.sessions.find((entry) => entry.id === trimmed);
    if (existing) {
      existing.updatedAt = now;
    } else {
      this.sessions.push({ id: trimmed, updatedAt: now });
    }
  };

  @action
  private rebuildSessionsFromMessages = () => {
    const seen = new Map<string, number>();
    this.messages.forEach((message) => {
      if (!message.session) {
        return;
      }
      const next = Math.max(seen.get(message.session) || 0, message.timestamp || 0);
      seen.set(message.session, next);
    });
    this.sessions = Array.from(seen.entries()).map(([id, updatedAt]) => ({
      id,
      updatedAt,
    }));
  };
}

export default new ChatStore();
