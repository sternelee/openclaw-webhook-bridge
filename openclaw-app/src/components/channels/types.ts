/**
 * Type definitions for channel components.
 */

export type ChannelStatus = "ok" | "warn" | "danger" | "unknown";

export interface ChannelAccount {
  name: string;
  accountId: string;
  status: ChannelStatus;
  lastInbound?: string;
  lastError?: string;
}

export interface WhatsAppStatus {
  configured: boolean;
  linked: boolean;
  running: boolean;
  connected: boolean;
  lastConnect?: string;
  lastMessage?: string;
  authAge?: string;
  error?: string;
  qrCode?: string;
}

export interface NostrProfile {
  name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  nip05?: string;
}

export interface NostrStatus {
  publicKey?: string;
  profile?: NostrProfile;
  lastStart?: string;
}
