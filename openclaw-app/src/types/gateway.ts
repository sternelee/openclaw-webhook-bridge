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

/** Session entry from gateway */
export interface GatewaySessionRow {
  key: string;
  label: string | null;
  kind: string;
  updatedAt: number | null;
  modelProvider: string | null;
  thinkingLevel: string | null;
  verboseLevel: string | null;
  reasoningLevel: string | null;
  messageCount: number;
  totalTokens: number | null;
  displayName?: string;
}

/** Sessions list result */
export interface SessionsListResult {
  ts: number;
  path: string;
  count: number;
  defaults: { model: string | null; contextTokens: number | null };
  sessions: GatewaySessionRow[];
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
