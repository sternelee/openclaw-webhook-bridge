/**
 * Chat page - Main chat interface with streaming support.
 * Ported from /Users/sternelee/www/github/openclaw/ui/src/ui/views/chat.ts
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { MessageGroup, groupMessages, ChatInput, StreamingMessage, ReadingIndicator } from "@/components/chat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/ui/icons";
import { loadSettings, saveSettings } from "@/types/storage";

export default function ChatPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<string | null>(null);

  const {
    connected,
    messages,
    stream,
    streamStartedAt,
    sending,
    focusMode,
    showThinking,
    sessionKey,
    setFocusMode,
    connect,
    disconnect,
    sendMessage,
    abortRun,
    resetSession,
    loadChatHistory,
  } = useAppStore();

  // Load settings and connect on mount
  useEffect(() => {
    const settings = loadSettings();
    if (settings.gatewayUrl) {
      connect();
    }
    loadChatHistory();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, stream]);

  // Build chat items
  const chatItems = buildChatItems(messages, stream, streamStartedAt, showThinking);

  const handleSend = (content: string) => {
    sendMessage(content);
  };

  const handleAbort = () => {
    abortRun();
  };

  const handleToggleFocusMode = () => {
    const newFocusMode = !focusMode;
    setFocusMode(newFocusMode);

    // Update settings
    const settings = loadSettings();
    settings.chatFocusMode = newFocusMode;
    saveSettings(settings);
  };

  const handleNewSession = () => {
    resetSession();
  };

  const handleOpenSidebar = (content: string) => {
    setSidebarContent(content);
    setSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
    setSidebarContent(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      {!focusMode && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Chat</h1>
            <span className="text-sm text-muted-foreground">Session: {sessionKey}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              connected ? "bg-ok/10 text-ok" : "bg-muted/50 text-muted-foreground"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-ok animate-pulse" : ""}`} />
              {connected ? "Connected" : "Disconnected"}
            </div>

            {/* Focus mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFocusMode}
              className="gap-1"
            >
              <Icons.maximize className="h-4 w-4" />
              Focus
            </Button>
          </div>
        </header>
      )}

      {/* Focus mode exit button */}
      {focusMode && (
        <button
          onClick={handleToggleFocusMode}
          className="absolute top-4 right-4 z-50 p-2 rounded-lg bg-card/50 hover:bg-card border border-border/50"
          aria-label="Exit focus mode"
        >
          <Icons.x className="h-4 w-4" />
        </button>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat thread */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1 px-4">
            <div ref={scrollRef} className="py-4">
              {!connected && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Icons.wifiOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Not Connected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure your gateway connection to start chatting.
                    </p>
                    <Button variant="default" onClick={() => router.push("/config")}>
                      Go to Settings
                    </Button>
                  </div>
                </div>
              )}

              {connected && chatItems.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Icons.messageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                    <p className="text-sm text-muted-foreground">
                      Send a message to begin chatting with OpenClaw.
                    </p>
                  </div>
                </div>
              )}

              {chatItems.map((item) => (
                <div key={item.key}>{item.content}</div>
              ))}
            </div>
          </ScrollArea>

          {/* Chat input */}
          <ChatInput
            onSend={handleSend}
            onAbort={handleAbort}
            disabled={!connected}
            sending={sending}
          />
        </div>

        {/* Sidebar for tool output etc. */}
        {sidebarOpen && (
          <>
            {/* Resizer handle */}
            <div className="w-1 hover:bg-accent cursor-col-resize" />
            <aside className="w-80 border-l border-border/50 bg-card/50 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <h2 className="font-medium">Details</h2>
                <Button variant="ghost" size="sm" onClick={handleCloseSidebar}>
                  <Icons.x className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                {sidebarContent ? (
                  <div className="prose prose-invert prose-sm max-w-none dark:prose-invert">
                    <pre className="whitespace-pre-wrap text-sm">{sidebarContent}</pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select an item to view details.</p>
                )}
              </ScrollArea>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

const CHAT_HISTORY_RENDER_LIMIT = 200;

function buildChatItems(
  messages: any[],
  stream: string | null,
  streamStartedAt: number | null,
  showThinking: boolean,
): Array<{ key: string; content: React.ReactNode }> {
  const items: Array<{ key: string; content: React.ReactNode }> = [];

  // Apply history limit
  const history = Array.isArray(messages) ? messages : [];
  const historyStart = Math.max(0, history.length - CHAT_HISTORY_RENDER_LIMIT);

  if (historyStart > 0) {
    items.push({
      key: "history-notice",
      content: (
        <div className="text-center py-2">
          <span className="text-xs text-muted-foreground">
            Showing last {CHAT_HISTORY_RENDER_LIMIT} messages ({historyStart} hidden)
          </span>
        </div>
      ),
    });
  }

  // Group messages by role
  const visibleMessages = history.slice(historyStart);
  const groups = groupMessages(visibleMessages);

  for (const group of groups) {
    items.push({
      key: `group-${group.role}-${group.timestamp}`,
      content: (
        <MessageGroup
          key={group.timestamp}
          messages={group.messages}
          role={group.role}
          timestamp={group.timestamp}
        />
      ),
    });
  }

  // Streaming indicator
  if (stream !== null) {
    const key = `stream-${streamStartedAt || "live"}`;
    if (stream.trim().length > 0) {
      items.push({
        key,
        content: <StreamingMessage text={stream} startedAt={streamStartedAt || Date.now()} />,
      });
    } else {
      items.push({
        key,
        content: <ReadingIndicator />,
      });
    }
  }

  return items;
}
