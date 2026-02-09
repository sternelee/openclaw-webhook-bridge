/**
 * Chat utility functions for message handling, copying, etc.
 */

import type { ChatMessage, MessageContentItem } from "@/types";

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract plain text from message content (for copying)
 */
export function extractMessageText(message: ChatMessage): string {
  const { content } = message;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textItems = content
      .filter((item: MessageContentItem) => item.type === "text")
      .map((item: MessageContentItem) => item.text || "")
      .filter(Boolean);
    return textItems.join("\n\n");
  }

  return "";
}

/**
 * Convert message to markdown format for copying
 */
export function messageToMarkdown(message: ChatMessage): string {
  const { role, content, timestamp } = message;

  const roleLabel = {
    user: "**You**",
    assistant: "**Assistant**",
    system: "**System**",
    tool: "**Tool**",
    tool_result: "**Tool Result**",
  }[role] || `**${role}**`;

  const date = timestamp ? new Date(timestamp).toLocaleString() : "";
  const text = extractMessageText(message);

  return `${roleLabel} ${date ? `(${date})` : ""}\n\n${text}`;
}

/**
 * Convert multiple messages to markdown
 */
export function messagesToMarkdown(messages: ChatMessage[]): string {
  return messages.map(messageToMarkdown).join("\n\n---\n\n");
}

/**
 * Format message content for display
 */
export function formatMessageContent(content: string | MessageContentItem[]): {
  text: string;
  toolCalls: Array<{ name: string; args?: unknown }>;
  toolResults: Array<{ name: string; text?: string }>;
} {
  const result = {
    text: "",
    toolCalls: [] as Array<{ name: string; args?: unknown }>,
    toolResults: [] as Array<{ name: string; text?: string }>,
  };

  if (typeof content === "string") {
    result.text = content;
    return result;
  }

  if (!Array.isArray(content)) {
    return result;
  }

  const textItems: string[] = [];
  for (const item of content) {
    if (item.type === "text" && item.text) {
      textItems.push(item.text);
    } else if (item.type === "tool_call") {
      result.toolCalls.push({
        name: item.name || "unknown",
        args: item.args,
      });
    } else if (item.type === "tool_result") {
      result.toolResults.push({
        name: item.name || "unknown",
        text: item.text,
      });
    }
  }

  result.text = textItems.join("\n\n");
  return result;
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Count tokens (approximate, using rough estimate)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
