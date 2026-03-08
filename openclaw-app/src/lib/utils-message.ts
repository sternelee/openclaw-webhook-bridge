/**
 * Message utilities - extracted from official OpenClaw UI.
 * Provides message normalization, extraction, and caching.
 */

import type { ChatMessage, MessageContentItem } from "@/types";

/**
 * Normalize role for grouping purposes.
 */
export function normalizeRoleForGrouping(role: string): string {
  const lower = role.toLowerCase();
  if (role === "user" || role === "User") {
    return role;
  }
  if (role === "assistant") {
    return "assistant";
  }
  if (role === "system") {
    return "system";
  }
  // Keep tool-related roles distinct
  if (
    lower === "toolresult" ||
    lower === "tool_result" ||
    lower === "tool" ||
    lower === "function"
  ) {
    return "tool";
  }
  return role;
}

/**
 * Check if a message is a tool result message based on its role.
 */
export function isToolResultMessage(message: ChatMessage): boolean {
  const role = typeof message.role === "string" ? message.role.toLowerCase() : "";
  return role === "toolresult" || role === "tool_result";
}

/**
 * Normalize message content to a consistent structure.
 */
export function normalizeMessageContent(content: string | MessageContentItem[] | undefined): MessageContentItem[] {
  if (!content) {
    return [];
  }
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    return content;
  }
  return [];
}

/**
 * Extract plain text from message content.
 */
export function extractText(message: ChatMessage): string {
  const content = normalizeMessageContent(message.content);

  if (content.length === 0) {
    // Fallback to string content
    if (typeof message.content === "string") {
      return message.content;
    }
    // Fallback to text field
    if (typeof message.text === "string") {
      return message.text;
    }
    return "";
  }

  const textItems = content
    .filter((item) => item.type === "text")
    .map((item) => item.text || "")
    .filter(Boolean);

  return textItems.join("\n");
}

/**
 * Extract thinking/reasoning content from message.
 */
export function extractThinking(message: ChatMessage): string | null {
  const content = normalizeMessageContent(message.content);
  const parts: string[] = [];

  for (const item of content) {
    // Handle thinking type
    if ("thinking" in item && typeof item.thinking === "string") {
      const cleaned = item.thinking.trim();
      if (cleaned) {
        parts.push(cleaned);
      }
    }
  }

  if (parts.length > 0) {
    return parts.join("\n");
  }

  // Back-compat: older messages may have <think> tags inside text blocks
  const text = extractText(message);
  if (!text) {
    return null;
  }

  const matches = [...text.matchAll(/<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi)];
  const extracted = matches.map((m) => (m[1] ?? "").trim()).filter(Boolean);
  return extracted.length > 0 ? extracted.join("\n") : null;
}

/**
 * Format reasoning/thinking as markdown.
 */
export function formatReasoningMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `_${line}_`);
  return lines.length ? ["_Reasoning:_", ...lines].join("\n") : "";
}

/**
 * Strip thinking tags from text (for assistant messages).
 */
export function stripThinkingTags(text: string): string {
  return text.replace(/<\s*think(?:ing)?\s*>[\s\S]*?<\s*\/\s*think(?:ing)?\s*>/gi, "").trim();
}

/**
 * Extract images from message content.
 */
export function extractImages(message: ChatMessage): Array<{ url: string; alt?: string }> {
  const images: Array<{ url: string; alt?: string }> = [];
  const content = normalizeMessageContent(message.content);

  for (const block of content) {
    if (block.type === "image") {
      // Handle source object format
      if ("source" in block && block.source) {
        const source = block.source as Record<string, unknown>;
        if (source.type === "base64" && typeof source.data === "string") {
          const mediaType = (source.media_type as string) || "image/png";
          const url = (source.data as string).startsWith("data:")
            ? source.data
            : `data:${mediaType};base64,${source.data}`;
          images.push({ url });
        }
      } else if ("url" in block && typeof block.url === "string") {
        images.push({ url: block.url });
      }
    } else if (block.type === "image_url") {
      // OpenAI format
      if ("image_url" in block && block.image_url) {
        const imageUrl = block.image_url as Record<string, unknown>;
        if (typeof imageUrl.url === "string") {
          images.push({ url: imageUrl.url });
        }
      }
    }
  }

  return images;
}

/**
 * Get role display info for UI.
 */
export function getRoleDisplayInfo(role: string): {
  label: string;
  avatarInitial: string;
  roleClass: "user" | "assistant" | "tool" | "other";
} {
  const normalized = normalizeRoleForGrouping(role);

  if (normalized === "user") {
    return { label: "You", avatarInitial: "U", roleClass: "user" };
  }
  if (normalized === "assistant") {
    return { label: "Assistant", avatarInitial: "A", roleClass: "assistant" };
  }
  if (normalized === "tool") {
    return { label: "Tool", avatarInitial: "⚙", roleClass: "tool" };
  }
  return { label: role, avatarInitial: "?", roleClass: "other" };
}

/**
 * Group consecutive messages from the same role.
 * Similar to official OpenClaw UI grouping.
 */
export function groupMessagesByRole(messages: ChatMessage[]): Array<{
  role: string;
  messages: ChatMessage[];
  timestamp: number;
  isStreaming?: boolean;
}> {
  const groups: Array<{
    role: string;
    messages: ChatMessage[];
    timestamp: number;
    isStreaming?: boolean;
  }> = [];

  for (const message of messages) {
    const normalizedRole = normalizeRoleForGrouping(message.role);
    const timestamp = message.timestamp || Date.now();
    const isStreaming = message.status === "streaming";

    if (groups.length === 0 || normalizeRoleForGrouping(groups[groups.length - 1].role) !== normalizedRole) {
      groups.push({
        role: normalizedRole,
        messages: [message],
        timestamp,
        isStreaming,
      });
    } else {
      groups[groups.length - 1].messages.push(message);
      // Update timestamp to latest
      groups[groups.length - 1].timestamp = timestamp;
    }
  }

  return groups;
}

/**
 * Convert ChatMessage to markdown format for copying.
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
  const text = extractText(message);

  return `${roleLabel} ${date ? `(${date})` : ""}\n\n${text}`;
}

/**
 * Get display text for a message (for previews, etc).
 */
export function getMessageDisplayText(message: ChatMessage): string {
  const text = extractText(message);
  const thinking = extractThinking(message);

  // If there's thinking, show it as preview too
  if (thinking) {
    return `🤔 ${text.slice(0, 50)}${text.length > 50 ? "..." : ""}`;
  }

  return text.slice(0, 100) + (text.length > 100 ? "..." : "");
}
