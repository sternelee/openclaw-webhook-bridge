/**
 * MessageGroup component for displaying consecutive messages from the same role.
 * Slack-style grouping for cleaner chat display.
 */

import { useState } from "react";
import { MessageBubble, getMessagePreview } from "./MessageBubble";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils-chat";
import {
  groupMessagesByRole,
  normalizeRoleForGrouping,
} from "@/lib/utils-message";
import type { ChatMessage } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface MessageGroupProps {
  messages: ChatMessage[];
  role: string;
  timestamp: number;
  onViewToolDetail?: (content: string) => void;
}

export function MessageGroup({
  messages,
  role,
  timestamp,
  onViewToolDetail,
}: MessageGroupProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  if (messages.length === 0) return null;

  const isUser = role === "user";
  const timeString = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
  });

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

  const handleCopyAll = async () => {
    // Copy all messages in the group as markdown
    const allContent = messages
      .map((msg) =>
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
      )
      .join("\n\n---\n\n");

    const success = await copyToClipboard(allContent);

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  };

  return (
    <div
      className={`flex gap-2 md:gap-3 ${isUser ? "flex-row-reverse" : ""} mb-3 md:mb-4 group`}
    >
      {/* Avatar - hide on mobile for user messages */}
      {!isUser && roleInfo.icon && (
        <div
          className={`hidden md:flex flex-shrink-0 w-8 h-8 rounded-full ${roleInfo.bgColor} items-center justify-center`}
        >
          <roleInfo.icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Messages */}
      <div
        className={`flex flex-col gap-1 max-w-[85%] md:max-w-[80%] ${isUser ? "items-end" : "items-start"} w-full`}
      >
        {/* Role header (only for non-user) - compact on mobile */}
        {!isUser && (
          <div className="flex items-center gap-1.5 md:gap-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">
              {roleInfo.label}
            </span>
            <span className="text-xs text-muted-foreground/50 hidden sm:inline">
              {timeString}
            </span>
            {messages.length > 1 && (
              <span className="text-xs text-muted-foreground/50">
                {messages.length} messages
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 md:h-5 md:w-auto md:px-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0 md:p-auto"
              onClick={handleCopyAll}
              title={
                copied
                  ? "Copied!"
                  : copyError
                    ? "Copy failed"
                    : "Copy all messages"
              }
            >
              {copied ? (
                <Icons.check className="h-3 w-3 text-ok" />
              ) : copyError ? (
                <Icons.x className="h-3 w-3 text-destructive" />
              ) : (
                <Icons.copy className="h-3 w-3" />
              )}
              <span className="hidden md:inline ml-1">
                {copied ? "Copied" : copyError ? "Error" : "Copy"}
              </span>
            </Button>
          </div>
        )}

        {/* Individual messages - no headers */}
        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.id || `${role}-${timestamp}-${index}`}`}
            message={message}
            onViewToolDetail={onViewToolDetail}
            showHeader={false}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Group consecutive messages from the same role together.
 * Uses the improved grouping logic from utils-message.
 */
export function groupMessages(messages: ChatMessage[]): Array<{
  role: string;
  messages: ChatMessage[];
  timestamp: number;
  isStreaming?: boolean;
}> {
  return groupMessagesByRole(messages);
}
