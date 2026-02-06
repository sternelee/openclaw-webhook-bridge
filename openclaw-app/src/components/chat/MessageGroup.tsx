/**
 * MessageGroup component for displaying consecutive messages from the same role.
 * Slack-style grouping for cleaner chat display.
 */

import { MessageBubble, getMessagePreview } from "./MessageBubble";
import { Icons } from "@/components/ui/icons";
import type { ChatMessage } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface MessageGroupProps {
  messages: ChatMessage[];
  role: string;
  timestamp: number;
  onViewToolDetail?: (content: string) => void;
}

export function MessageGroup({ messages, role, timestamp, onViewToolDetail }: MessageGroupProps) {
  if (messages.length === 0) return null;

  const isUser = role === "user";
  const timeString = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  // Get role display info
  const getRoleInfo = () => {
    if (isUser) {
      return {
        label: "You",
        icon: null,
        bgColor: "bg-accent/10",
      };
    }
    if (role === "system") {
      return {
        label: "System",
        icon: Icons.circle,
        bgColor: "bg-muted/50",
      };
    }
    if (role === "tool" || role === "tool_result") {
      return {
        label: "Tool",
        icon: Icons.wrench,
        bgColor: "bg-muted/50",
      };
    }
    return {
      label: "Assistant",
      icon: Icons.brain,
      bgColor: "bg-card",
    };
  };

  const roleInfo = getRoleInfo();
  const preview = messages.length > 0 ? getMessagePreview(messages[0], 60) : "";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} mb-4`}>
      {/* Avatar */}
      {!isUser && roleInfo.icon && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${roleInfo.bgColor} flex items-center justify-center`}>
          <roleInfo.icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Messages */}
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Role header (only for non-user) */}
        {!isUser && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">{roleInfo.label}</span>
            <span className="text-xs text-muted-foreground/50">{timeString}</span>
            {messages.length > 1 && (
              <span className="text-xs text-muted-foreground/50">{messages.length} messages</span>
            )}
          </div>
        )}

        {/* Individual messages */}
        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.id || `${role}-${timestamp}-${index}`}`}
            message={message}
            onViewToolDetail={onViewToolDetail}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Group consecutive messages from the same role together.
 */
export function groupMessages(messages: ChatMessage[]): Array<{
  role: string;
  messages: ChatMessage[];
  timestamp: number;
}> {
  const groups: Array<{ role: string; messages: ChatMessage[]; timestamp: number }> = [];

  for (const message of messages) {
    const role = normalizeRoleForGrouping(message.role);
    const timestamp = message.timestamp || Date.now();

    if (groups.length === 0 || groups[groups.length - 1].role !== role) {
      groups.push({
        role,
        messages: [message],
        timestamp,
      });
    } else {
      groups[groups.length - 1].messages.push(message);
    }
  }

  return groups;
}

/**
 * Normalize role for grouping (e.g., tool_result -> tool)
 */
function normalizeRoleForGrouping(role: string): string {
  const normalized = role.toLowerCase();
  if (normalized === "tool_result" || normalized === "toolresult" || normalized === "toolresult") {
    return "tool";
  }
  if (normalized === "tool_call" || normalized === "toolcall") {
    return "tool";
  }
  return normalized;
}
