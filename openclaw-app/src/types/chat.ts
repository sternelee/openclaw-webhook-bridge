/**
 * Chat message types for the UI layer.
 */

/** Union type for items in the chat thread */
export type ChatItem =
  | { kind: "message"; key: string; message: ChatMessage }
  | { kind: "stream"; key: string; text: string; startedAt: number }
  | { kind: "reading-indicator"; key: string };

/** A group of consecutive messages from the same role (Slack-style layout) */
export type MessageGroup = {
  kind: "group";
  key: string;
  role: string;
  messages: Array<{ message: ChatMessage; key: string }>;
  timestamp: number;
  isStreaming: boolean;
};

/** Content item types in a normalized message */
export interface MessageContentItemBase {
  type: string;
}

export interface TextContentItem extends MessageContentItemBase {
  type: "text";
  text?: string;
}

export interface ToolCallItem extends MessageContentItemBase {
  type: "tool_call";
  name?: string;
  args?: unknown;
}

export interface ToolResultItem extends MessageContentItemBase {
  type: "tool_result";
  name?: string;
  text?: string;
}

export interface ImageItem extends MessageContentItemBase {
  type: "image";
  url?: string;
  source?: { type: string; media_type?: string; data?: string };
}

export interface ImageUrlItem extends MessageContentItemBase {
  type: "image_url";
  image_url?: { url?: string };
}

export interface ThinkingItem extends MessageContentItemBase {
  type: "thinking";
  thinking?: string;
}

export type MessageContentItem =
  | TextContentItem
  | ToolCallItem
  | ToolResultItem
  | ImageItem
  | ImageUrlItem
  | ThinkingItem;

// Re-export for convenience
export type { TextContentItem as TextItem, ToolCallItem as ToolCall, ToolResultItem as ToolResult };

/** Normalized message structure for rendering */
export interface NormalizedMessage {
  role: string;
  content: MessageContentItem[];
  timestamp: number;
  id?: string;
}

/** Tool card representation for tool calls and results */
export type ToolCard = {
  kind: "call" | "result";
  name: string;
  args?: unknown;
  text?: string;
};

/** Chat message structure */
export interface ChatMessage {
  role: string;
  content: MessageContentItem[] | string;
  timestamp: number;
  id?: string;
  status?: "sending" | "sent" | "error" | "streaming";
  session?: string;
  messageType?: "chat" | "tool_call" | "tool_result" | "thought";
  toolName?: string;
  toolResult?: "running" | "success" | "error";
  collapsed?: boolean;
  text?: string; // Alternative text field for backward compatibility
}

/** Chat attachment for image uploads */
export interface ChatAttachment {
  id: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
}

/** Chat queue item for queued messages */
export interface ChatQueueItem {
  id: string;
  text: string;
  attachments?: ChatAttachment[];
  timestamp: number;
}

/** Chat event payload from gateway */
export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: ChatMessage;
  errorMessage?: string;
}
