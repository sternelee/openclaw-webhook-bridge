export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: number;
  status?: "sending" | "sent" | "error" | "streaming";
  read?: boolean; // Read receipt status
  session?: string;
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
