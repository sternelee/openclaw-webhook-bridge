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
export type MessageContentItem = {
  type: "text" | "tool_call" | "tool_result" | "image";
  text?: string;
  name?: string;
  args?: unknown;
  source?: { type: string; media_type?: string; data?: string };
};

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
}

/** Chat attachment for image uploads */
export interface ChatAttachment {
  id: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
}

/** Chat event payload from gateway */
export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: ChatMessage;
  errorMessage?: string;
}
