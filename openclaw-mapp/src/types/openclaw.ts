export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: number;
  status?: "sending" | "sent" | "error" | "streaming";
  read?: boolean; // Read receipt status
  session?: string;
  messageType?: "chat" | "tool_call" | "tool_result" | "thought"; // Message type for display
  toolName?: string; // Tool name for tool_call messages
  toolResult?: "success" | "error" | "running"; // Tool execution status
  collapsed?: boolean; // For tool_call/tool_result messages, whether content is collapsed
}

export interface SendMessageRequest {
  id: string;
  content: string;
  session?: string;
  peerKind?: "dm" | "group" | "channel";
  peerId?: string;
  topicId?: string;
  threadId?: string;
}

export interface ProgressMessage {
  type: "progress";
  content: string;
  session: string;
}

export interface CompleteMessage {
  type: "complete";
  content: string;
  session: string;
}

export interface ErrorMessage {
  type: "error";
  error: string;
  session: string;
}

export type OpenClawServerMessage =
  | ProgressMessage
  | CompleteMessage
  | ErrorMessage;

export interface WebSocketMessage {
  type?: string;
  id?: string;
  content?: string;
  session?: string;
  error?: string;
}
