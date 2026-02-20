/**
 * Zustand store for OpenClaw web app state management.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { GatewayClient, WebhookMessage } from '@/lib/utils-gateway';
import type {
  ChatMessage,
  ChatAttachment,
  ChatQueueItem,
  GatewayHelloOk,
  SessionsListResult,
  SessionsPatchResult,
  PresenceEntry,
  EventLogEntry,
} from '@/types';
import * as SessionStorage from '@/lib/session-storage';

interface AppState {
  // Connection state
  connected: boolean;
  connecting: boolean;
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
  queue: ChatQueueItem[];
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
  setQueue: (queue: ChatQueueItem[]) => void;
  addToQueue: (item: ChatQueueItem) => void;
  removeFromQueue: (id: string) => void;
  processQueue: () => void;
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
  createNewSession: () => void;
  switchSession: (key: string) => void;
  getLocalSessions: () => SessionStorage.SessionMetadata[];
  saveCurrentSession: () => void;

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
        connecting: false,
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
        queue: [],
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
        addMessage: (message) => {
          set((state) => ({ messages: [...state.messages, message] }));
          // Auto-save to localStorage
          setTimeout(() => get().saveCurrentSession(), 100);
        },
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
        setQueue: (queue) => set({ queue }),
        addToQueue: (item) =>
          set((state) => ({ queue: [...state.queue, item] })),
        removeFromQueue: (id) =>
          set((state) => ({
            queue: state.queue.filter((q) => q.id !== id),
          })),
        processQueue: () => {
          const { queue, sending } = get();
          if (sending || queue.length === 0) return;
          
          const nextItem = queue[0];
          get().removeFromQueue(nextItem.id);
          get().sendMessage(nextItem.text, nextItem.attachments);
        },
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
          const { gatewayUrl, token, uid, client, connected, connecting } = get();
          if (!gatewayUrl) return;

          // If already connected or connecting, don't reconnect
          if (connected || connecting) return;

          // Set connecting state
          set({ connecting: true });

          // Stop existing client if any
          client?.stop();

          // Detect if connecting to Webhook (not Gateway)
          // Webhook URLs typically don't have port 18789 or localhost
          const isWebhookMode = !gatewayUrl.includes(':18789') && !gatewayUrl.includes('localhost') && !gatewayUrl.includes('127.0.0.1');

          // Import GatewayClient dynamically to avoid circular dependencies
          import('@/lib/utils-gateway').then(({ GatewayClient }) => {
            const newClient = new GatewayClient({
              url: gatewayUrl,
              token,
              uid,
              mode: isWebhookMode ? 'bridge' : 'control-ui',
              useWebhookMode: isWebhookMode,
              onHello: (hello) => {
                set({ connecting: false, hello: hello, connected: true, lastError: null });
                console.log('[Gateway] Connected:', hello);
                // Auto-load sessions after successful connection
                get().loadSessions();
              },
              onEvent: (evt) => {
                console.log('[Gateway] Event:', evt);
                
                // Handle chat events (from Gateway)
                if (evt.event === 'chat') {
                  const payload = evt.payload as any;
                  
                  // Extract text from content array
                  const extractText = (content: any): string => {
                    if (!content) return '';
                    if (typeof content === 'string') return content;
                    if (Array.isArray(content)) {
                      return content
                        .filter((c) => c.type === 'text')
                        .map((c) => c.text || '')
                        .join('');
                    }
                    return '';
                  };
                  
                  if (payload.state === 'delta') {
                    // Streaming response
                    const text = extractText(payload.message?.content);
                    if (text) {
                      set((state) => ({
                        stream: (state.stream || '') + text,
                      }));
                    }
                  } else if (payload.state === 'final') {
                    // Final response
                    if (payload.message) {
                      const text = extractText(payload.message.content);
                      const message: ChatMessage = {
                        role: payload.message.role || 'assistant',
                        content: text,
                        timestamp: payload.message.timestamp || Date.now(),
                      };
                      get().addMessage(message);
                    }
                    set({ stream: null, sending: false });
                    // Process queue after response completes
                    setTimeout(() => get().processQueue(), 100);
                  } else if (payload.state === 'error') {
                    set({
                      stream: null,
                      sending: false,
                      lastError: extractText(payload.message?.content) || 'An error occurred',
                    });
                  }
                  return;
                }
                
                // Handle agent events (legacy/bridge format)
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
                  // Process queue after response completes
                  setTimeout(() => get().processQueue(), 100);
                } else if (evt.event === 'agent.abort') {
                  // Abort event
                  const payload = evt.payload as any;
                  set({
                    stream: null,
                    sending: false,
                    lastError: payload.error || 'Run aborted',
                  });
                } else if (evt.event === 'agent') {
                  // Agent lifecycle events
                  const payload = evt.payload as any;
                  if (payload.stream === 'lifecycle' && payload.data?.phase === 'error') {
                    // Error phase in lifecycle
                    const errorMsg = payload.data.error || 'An error occurred';
                    console.error('[Gateway] Agent error:', errorMsg);
                    set({
                      stream: null,
                      sending: false,
                      lastError: errorMsg,
                    });
                  }
                } else if (evt.event === 'presence' || evt.event === 'health') {
                  // Presence/health events
                  // Update state version tracking
                  if (evt.stateVersion) {
                    // Handle state version updates
                  }
                }
              },
              onClose: (info) => {
                set({ connecting: false, connected: false, hello: null });
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
          set({ client: null, connected: false, connecting: false, hello: null });
        },

        sendMessage: async (content, attachments?) => {
          const { client, sessionKey, uid, sending } = get();
          if (!client || !client.connected) {
            set({ lastError: 'Not connected to gateway' });
            return null;
          }

          const trimmed = content.trim();
          if (!trimmed && !attachments?.length) return null;

          // If already sending, queue the message
          if (sending) {
            const queueItem: ChatQueueItem = {
              id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              text: trimmed,
              attachments,
              timestamp: Date.now(),
            };
            get().addToQueue(queueItem);
            return null;
          }

          set({ sending: true, lastError: null });

          try {
            // Add user message to local state
            const userMessage: ChatMessage = {
              role: 'user',
              content: trimmed,
              timestamp: Date.now(),
            };

            set((state) => ({ messages: [...state.messages, userMessage] }));

            // Send via Webhook simple format to bridge
            const runId = `run-${Date.now()}`;
            const msg: WebhookMessage = {
              id: runId,
              content: trimmed,
              sender_id: uid || 'webchat-user',
              session: sessionKey || 'main',
              peerKind: 'dm',
              peerId: uid || 'webchat-user',
              chatType: 'dm',
              chatId: uid || 'webchat-user',
              senderId: uid || 'webchat-user',
            };

            // Cast to any to access sendWebhookMessage method
            (client as any).sendWebhookMessage(msg);

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
          const { client, connected, sessionsLoading } = get();
          if (!client || !connected) {
            console.log('[Store] Cannot load sessions: not connected');
            return;
          }
          if (sessionsLoading) {
            console.log('[Store] Sessions already loading');
            return;
          }

          set({ sessionsLoading: true, sessionsError: null });

          console.log('[Store] Sending sessions.list request...');
          try {
            const res = await client.request<SessionsListResult | undefined>('sessions.list', {
              activeMinutes: 1440, // Last 24 hours (1440 minutes)
              limit: 100,
              includeGlobal: true,
              includeUnknown: true,
            });
            console.log('[Store] sessions.list response:', res);
            if (res) {
              set({ sessions: res, sessionsLoading: false });
              console.log('[Store] Loaded sessions:', res.count, 'sessions');
            } else {
              set({ sessionsLoading: false });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions';
            console.error('[Store] Failed to load sessions:', errorMessage);
            set({ sessionsError: errorMessage, sessionsLoading: false });
          }
        },

        patchSession: async (key, patch) => {
          const { client, connected } = get();
          if (!client || !connected) {
            console.log('[Store] Cannot patch session: not connected');
            return;
          }

          try {
            const params: Record<string, unknown> = { key };
            if ('label' in patch) params.label = patch.label;
            if ('thinkingLevel' in patch) params.thinkingLevel = patch.thinkingLevel;
            if ('verboseLevel' in patch) params.verboseLevel = patch.verboseLevel;
            if ('reasoningLevel' in patch) params.reasoningLevel = patch.reasoningLevel;

            await client.request<SessionsPatchResult>('sessions.patch', params);
            // Reload sessions after patch
            await get().loadSessions();
            console.log('[Store] Patched session:', key);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to patch session';
            console.error('[Store] Failed to patch session:', errorMessage);
            set({ sessionsError: errorMessage });
          }
        },

        deleteSession: async (key) => {
          const { client, connected, sessionsLoading } = get();
          if (!client || !connected) {
            console.log('[Store] Cannot delete session: not connected');
            return;
          }
          if (sessionsLoading) return;

          try {
            await client.request('sessions.delete', { key, deleteTranscript: true });
            // Reload sessions after delete
            await get().loadSessions();
            console.log('[Store] Deleted session:', key);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete session';
            console.error('[Store] Failed to delete session:', errorMessage);
            set({ sessionsError: errorMessage });
          }
        },

        resetSession: () => {
          set({
            messages: [],
            thinkingLevel: null,
            stream: null,
            streamStartedAt: null,
            runId: null,
            draft: '',
            attachments: [],
            queue: [],
            sending: false,
          });
        },

        createNewSession: () => {
          // Create new session via storage utility
          const metadata = SessionStorage.createNewSession();
          
          console.log('[Store] Creating new session:', metadata.key);
          
          set({
            sessionKey: metadata.key,
            messages: [],
            thinkingLevel: null,
            stream: null,
            streamStartedAt: null,
            runId: null,
            draft: '',
            attachments: [],
            queue: [],
            sending: false,
          });
        },

        switchSession: (key) => {
          console.log('[Store] Switching to session:', key);
          
          // Load session data from localStorage
          const sessionData = SessionStorage.getSessionData(key);
          
          if (sessionData) {
            set({
              sessionKey: key,
              messages: sessionData.messages,
              thinkingLevel: null,
              stream: null,
              streamStartedAt: null,
              runId: null,
              draft: '',
              attachments: [],
              queue: [],
              sending: false,
            });
          } else {
            // Session not found, create it
            set({
              sessionKey: key,
              messages: [],
              thinkingLevel: null,
              stream: null,
              streamStartedAt: null,
              runId: null,
              draft: '',
              attachments: [],
              queue: [],
              sending: false,
            });
          }
        },

        getLocalSessions: () => {
          return SessionStorage.getSessionsList();
        },

        saveCurrentSession: () => {
          const { sessionKey, messages } = get();
          
          const sessionData: SessionStorage.SessionData = {
            metadata: {
              key: sessionKey,
              label: null,
              messageCount: messages.length,
              updatedAt: Date.now(),
              createdAt: Date.now(), // Will be overwritten if exists
            },
            messages,
          };
          
          // Merge with existing metadata if available
          const existing = SessionStorage.getSessionData(sessionKey);
          if (existing) {
            sessionData.metadata.label = existing.metadata.label;
            sessionData.metadata.createdAt = existing.metadata.createdAt;
          }
          
          SessionStorage.saveSessionData(sessionKey, sessionData);
        },

        // Chat management
        loadChatHistory: async () => {
          const { sessionKey } = get();
          
          set({ sessionsLoading: true });
          try {
            // Load from localStorage
            const sessionData = SessionStorage.getSessionData(sessionKey);
            if (sessionData) {
              set({ 
                messages: sessionData.messages,
                sessionsLoading: false 
              });
              console.log('[Store] Loaded chat history:', sessionData.messages.length, 'messages');
            } else {
              set({ sessionsLoading: false });
            }
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
