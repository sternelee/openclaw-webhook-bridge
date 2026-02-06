/**
 * Zustand store for OpenClaw web app state management.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { GatewayClient } from '@/lib/utils-gateway';
import type {
  ChatMessage,
  ChatAttachment,
  GatewayHelloOk,
  SessionsListResult,
  PresenceEntry,
  EventLogEntry,
} from '@/types';

interface AppState {
  // Connection state
  connected: boolean;
  gatewayUrl: string;
  token: string;
  uid: string;
  client: GatewayClient | null;
  hello: GatewayHelloOk | null;
  lastError: string | null;

  // Chat state
  sessionKey: string;
  messages: ChatMessage[];
  thinkingLevel: string | null;
  sending: boolean;
  stream: string | null;
  streamStartedAt: number | null;
  runId: string | null;
  draft: string;
  attachments: ChatAttachment[];
  showThinking: boolean;
  focusMode: boolean;

  // Sessions state
  sessions: SessionsListResult | null;
  sessionsLoading: boolean;
  sessionsError: string | null;

  // System state
  presenceEntries: PresenceEntry[];
  eventLog: EventLogEntry[];
  assistantName: string;
  assistantAvatar: string | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setGatewayUrl: (url: string) => void;
  setToken: (token: string) => void;
  setUid: (uid: string) => void;
  setClient: (client: GatewayClient | null) => void;
  setHello: (hello: GatewayHelloOk | null) => void;
  setLastError: (error: string | null) => void;

  setSessionKey: (key: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setThinkingLevel: (level: string | null) => void;
  setSending: (sending: boolean) => void;
  setStream: (stream: string | null) => void;
  setStreamStartedAt: (time: number | null) => void;
  setRunId: (runId: string | null) => void;
  setDraft: (draft: string) => void;
  setAttachments: (attachments: ChatAttachment[]) => void;
  addAttachment: (attachment: ChatAttachment) => void;
  removeAttachment: (id: string) => void;
  setShowThinking: (show: boolean) => void;
  setFocusMode: (focus: boolean) => void;

  setSessions: (sessions: SessionsListResult | null) => void;
  setSessionsLoading: (loading: boolean) => void;
  setSessionsError: (error: string | null) => void;

  setPresenceEntries: (entries: PresenceEntry[]) => void;
  addEventLog: (entry: EventLogEntry) => void;
  setAssistantName: (name: string) => void;
  setAssistantAvatar: (avatar: string | null) => void;

  // Connection management
  connect: () => void;
  disconnect: () => void;
  sendMessage: (content: string, attachments?: ChatAttachment[]) => Promise<string | null>;
  abortRun: () => Promise<boolean>;

  // Session management
  loadSessions: () => Promise<void>;
  patchSession: (
    key: string,
    patch: {
      label?: string | null;
      thinkingLevel?: string | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    }
  ) => Promise<void>;
  deleteSession: (key: string) => Promise<void>;
  resetSession: () => void;

  // Chat management
  loadChatHistory: () => Promise<void>;
  clearChat: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        connected: false,
        gatewayUrl: '',
        token: '',
        uid: '',
        client: null,
        hello: null,
        lastError: null,

        sessionKey: 'main',
        messages: [],
        thinkingLevel: null,
        sending: false,
        stream: null,
        streamStartedAt: null,
        runId: null,
        draft: '',
        attachments: [],
        showThinking: true,
        focusMode: false,

        sessions: null,
        sessionsLoading: false,
        sessionsError: null,

        presenceEntries: [],
        eventLog: [],
        assistantName: 'OpenClaw',
        assistantAvatar: null,

        // Connection actions
        setConnected: (connected) => set({ connected }),
        setGatewayUrl: (url) => set({ gatewayUrl: url }),
        setToken: (token) => set({ token }),
        setUid: (uid) => set({ uid }),
        setClient: (client) => set({ client }),
        setHello: (hello) => set({ hello }),
        setLastError: (error) => set({ lastError: error }),

        // Chat actions
        setSessionKey: (key) => set({ sessionKey: key }),
        setMessages: (messages) => set({ messages }),
        addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
        setThinkingLevel: (level) => set({ thinkingLevel: level }),
        setSending: (sending) => set({ sending }),
        setStream: (stream) => set({ stream }),
        setStreamStartedAt: (time) => set({ streamStartedAt: time }),
        setRunId: (runId) => set({ runId }),
        setDraft: (draft) => set({ draft }),
        setAttachments: (attachments) => set({ attachments }),
        addAttachment: (attachment) =>
          set((state) => ({ attachments: [...state.attachments, attachment] })),
        removeAttachment: (id) =>
          set((state) => ({
            attachments: state.attachments.filter((a) => a.id !== id),
          })),
        setShowThinking: (show) => set({ showThinking: show }),
        setFocusMode: (focus) => set({ focusMode: focus }),

        // Sessions actions
        setSessions: (sessions) => set({ sessions }),
        setSessionsLoading: (loading) => set({ sessionsLoading: loading }),
        setSessionsError: (error) => set({ sessionsError: error }),

        // System actions
        setPresenceEntries: (entries) => set({ presenceEntries: entries }),
        addEventLog: (entry) =>
          set((state) => ({ eventLog: [entry, ...state.eventLog].slice(0, 250) })),
        setAssistantName: (name) => set({ assistantName: name }),
        setAssistantAvatar: (avatar) => set({ assistantAvatar: avatar }),

        // Connection management
        connect: () => {
          const { gatewayUrl, token, uid, client } = get();
          if (!gatewayUrl) return;

          // Stop existing client if any
          client?.stop();

          // Import GatewayClient dynamically to avoid circular dependencies
          import('@/lib/utils-gateway').then(({ GatewayClient }) => {
            const newClient = new GatewayClient({
              url: gatewayUrl,
              token,
              uid,
              mode: 'control-ui',
              onHello: (hello) => {
                set({ hello: hello, connected: true, lastError: null });
                console.log('[Gateway] Connected:', hello);
              },
              onEvent: (evt) => {
                console.log('[Gateway] Event:', evt);
                // Handle agent events
                if (evt.event === 'agent.delta') {
                  // Delta event - streaming response
                  const payload = evt.payload as any;
                  if (payload.content) {
                    set((state) => ({
                      stream: (state.stream || '') + payload.content,
                    }));
                  }
                } else if (evt.event === 'agent.final') {
                  // Final event - complete response
                  const payload = evt.payload as any;
                  if (payload.message) {
                    get().addMessage(payload.message);
                  }
                  set({ stream: null, sending: false });
                } else if (evt.event === 'agent.abort') {
                  // Abort event
                  const payload = evt.payload as any;
                  set({
                    stream: null,
                    sending: false,
                    lastError: payload.error || 'Run aborted',
                  });
                } else if (evt.event === 'presence' || evt.event === 'health') {
                  // Presence/health events
                  // Update state version tracking
                  if (evt.stateVersion) {
                    // Handle state version updates
                  }
                }
              },
              onClose: (info) => {
                set({ connected: false, hello: null });
                console.log('[Gateway] Closed:', info);
              },
            });

            set({ client: newClient });
            newClient.start();
          });
        },

        disconnect: () => {
          const { client } = get();
          client?.stop();
          set({ client: null, connected: false, hello: null });
        },

        sendMessage: async (content, attachments?) => {
          const { client } = get();
          if (!client || !client.connected) {
            set({ lastError: 'Not connected to gateway' });
            return null;
          }

          const trimmed = content.trim();
          if (!trimmed && !attachments?.length) return null;

          set({ sending: true, lastError: null });

          try {
            // Add user message to local state
            const userMessage: ChatMessage = {
              role: 'user',
              content: trimmed,
              timestamp: Date.now(),
            };

            set((state) => ({ messages: [...state.messages, userMessage] }));

            // Send via gateway (will be implemented)
            const runId = `run-${Date.now()}`;
            set({ runId, stream: '', streamStartedAt: Date.now() });

            return runId;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            set({ lastError: errorMessage, sending: false, runId: null, stream: null });
            return null;
          }
        },

        abortRun: async () => {
          const { client } = get();
          if (!client || !client.connected) return false;

          try {
            // Abort via gateway (will be implemented)
            set({ runId: null, stream: null, streamStartedAt: null, sending: false });
            return true;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to abort';
            set({ lastError: errorMessage });
            return false;
          }
        },

        // Session management
        loadSessions: async () => {
          set({ sessionsLoading: true, sessionsError: null });
          try {
            // Will be implemented with actual gateway call
            set({ sessionsLoading: false });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions';
            set({ sessionsError: errorMessage, sessionsLoading: false });
          }
        },

        patchSession: async (key, patch) => {
          // Will be implemented with actual gateway call
          console.log('[Store] Patch session:', key, patch);
        },

        deleteSession: async (key) => {
          // Will be implemented with actual gateway call
          console.log('[Store] Delete session:', key);
        },

        resetSession: () => {
          set({
            messages: [],
            thinkingLevel: null,
            stream: null,
            streamStartedAt: null,
            runId: null,
          });
        },

        // Chat management
        loadChatHistory: async () => {
          const { client } = get();
          if (!client || !client.connected) return;

          set({ sessionsLoading: true });
          try {
            // Will be implemented with actual gateway call
            set({ sessionsLoading: false });
          } catch (error) {
            console.error('[Store] Failed to load chat history:', error);
            set({ sessionsLoading: false });
          }
        },

        clearChat: () => {
          set({
            messages: [],
            thinkingLevel: null,
            stream: null,
            streamStartedAt: null,
            runId: null,
          });
        },
      }),
      {
        name: 'openclaw-app-storage',
        partialize: (state) => ({
          gatewayUrl: state.gatewayUrl,
          token: state.token,
          uid: state.uid,
          sessionKey: state.sessionKey,
          showThinking: state.showThinking,
          focusMode: state.focusMode,
          assistantName: state.assistantName,
        }),
      }
    )
  )
);
