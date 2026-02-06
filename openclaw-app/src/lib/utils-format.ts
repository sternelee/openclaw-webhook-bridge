/**
 * Formatting utilities for dates, tokens, and text.
 */

import { formatDistanceToNow } from "date-fns";

/**
 * Format a timestamp as "X time ago" (e.g., "5 minutes ago")
 */
export function formatAgo(timestamp: number | null | undefined): string {
  if (!timestamp) return "n/a";
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "n/a";
  }
}

/**
 * Format session tokens for display
 */
export function formatSessionTokens(session: {
  totalTokens: number | null;
  messageCount: number;
}): string {
  if (session.totalTokens !== null) {
    return session.totalTokens.toLocaleString();
  }
  return `${session.messageCount} msgs`;
}

/**
 * Extract text content from a message
 */
export function extractText(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const msg = message as { role?: string; content?: unknown };

  if (Array.isArray(msg.content)) {
    const textItems = msg.content
      .filter((item) => item && typeof item === "object" && item.type === "text")
      .map((item) => (item as { text?: string }).text || "")
      .join("\n");
    return textItems || null;
  }

  if (typeof msg.content === "string") {
    return msg.content;
  }

  return null;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
