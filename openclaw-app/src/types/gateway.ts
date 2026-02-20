/**
 * Gateway protocol types for WebSocket communication.
 */

/** Gateway event frame */
export interface GatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
}

/** Gateway response frame */
export interface GatewayResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

/** Gateway hello response */
export interface GatewayHelloOk {
  type: "hello-ok";
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
}

/** Gateway request frame */
export interface GatewayRequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

/** Client modes */
export type GatewayClientMode = "control-ui" | "webchat" | "bridge";

/** Client names */
export type GatewayClientName = "openclaw-control-ui" | "openclaw-webchat" | "openclaw-bridge";

/** Gateway client options */
export interface GatewayClientOptions {
  url: string;
  token?: string;
  password?: string;
  uid?: string;
  clientName?: GatewayClientName;
  clientVersion?: string;
  platform?: string;
  mode?: GatewayClientMode;
  instanceId?: string;
  /** Use Webhook simple format mode (skip Gateway protocol handshake) */
  useWebhookMode?: boolean;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
}

/** Agent event payload */
export interface AgentEventPayload {
  runId?: string;
  state?: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
}

/** Session entry from gateway (matches openclaw/ui) */
export interface GatewaySessionRow {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  surface?: string;
  subject?: string;
  room?: string;
  space?: string;
  updatedAt: number | null;
  sessionId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
  // Additional fields from last message
  lastMessage?: string;
  lastMessageAt?: number;
}

/** Sessions defaults from gateway */
export interface GatewaySessionsDefaults {
  defaultAgentId: string;
  mainKey: string;
  mainSessionKey: string;
  scope?: string;
}

/** Sessions list result (matches openclaw/ui) */
export interface SessionsListResult {
  ts: number;
  path: string;
  count: number;
  defaults: GatewaySessionsDefaults;
  sessions: GatewaySessionRow[];
}

/** Sessions patch result */
export interface SessionsPatchResult {
  ok: true;
  path: string;
  key: string;
  entry: {
    sessionId: string;
    updatedAt?: number;
    thinkingLevel?: string;
    verboseLevel?: string;
    reasoningLevel?: string;
    elevatedLevel?: string;
  };
}

/** Presence entry */
export interface PresenceEntry {
  instanceId: string;
  connectedAt: number;
  mode: string;
}

/** Health snapshot */
export interface HealthSnapshot {
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  [key: string]: unknown;
}

/** Status summary */
export interface StatusSummary {
  status: string;
  connected: number;
  [key: string]: unknown;
}

/** Agents list result */
export interface AgentsListResult {
  agents: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

/** Event log entry */
export interface EventLogEntry {
  ts: number;
  event: string;
  payload?: unknown;
}
