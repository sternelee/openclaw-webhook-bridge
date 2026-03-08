/**
 * Message utilities for WeChat Mini-Program
 * Based on official OpenClaw UI patterns
 */

import type { ChatMessage } from '../types/openclaw';

/**
 * Normalize role for grouping purposes.
 */
export function normalizeRoleForGrouping(role: string): string {
  const lower = role.toLowerCase();
  if (role === 'user' || role === 'User') {
    return role;
  }
  if (role === 'assistant') {
    return 'assistant';
  }
  if (role === 'system') {
    return 'system';
  }
  // Keep tool-related roles distinct
  if (
    lower === 'toolresult' ||
    lower === 'tool_result' ||
    lower === 'tool' ||
    lower === 'function'
  ) {
    return 'tool';
  }
  return role;
}

/**
 * Extract plain text from message content.
 */
export function extractMessageText(message: ChatMessage): string {
  const { content } = message;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textItems = content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text || '')
      .filter(Boolean);
    return textItems.join('\n\n');
  }

  return '';
}

/**
 * Extract thinking/reasoning content from message.
 * Note: Mini-program stores content as string, so we check for thinking tags in text.
 */
export function extractThinking(message: ChatMessage): string | null {
  const { content } = message;

  // Mini-program content is a string, check for thinking tags
  if (typeof content === 'string') {
    const matches = [...content.matchAll(/<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi)];
    const extracted = matches.map((m) => (m[1] ?? '').trim()).filter(Boolean);
    return extracted.length > 0 ? extracted.join('\n') : null;
  }

  return null;
}

/**
 * Format reasoning/thinking as markdown.
 */
export function formatReasoningMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `_${line}_`);
  return lines.length ? ['_Reasoning:_', ...lines].join('\n') : '';
}

/**
 * Group consecutive messages from the same role.
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
    const isStreaming = message.status === 'streaming';

    if (
      groups.length === 0 ||
      normalizeRoleForGrouping(groups[groups.length - 1].role) !== normalizedRole
    ) {
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
 * Get role display info for UI.
 */
export function getRoleDisplayInfo(role: string): {
  label: string;
  avatarInitial: string;
  roleClass: 'user' | 'assistant' | 'tool' | 'other';
} {
  const normalized = normalizeRoleForGrouping(role);

  if (normalized === 'user') {
    return { label: 'You', avatarInitial: 'U', roleClass: 'user' };
  }
  if (normalized === 'assistant') {
    return { label: 'Assistant', avatarInitial: 'A', roleClass: 'assistant' };
  }
  if (normalized === 'tool') {
    return { label: 'Tool', avatarInitial: '⚙', roleClass: 'tool' };
  }
  return { label: role, avatarInitial: '?', roleClass: 'other' };
}
