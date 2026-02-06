/**
 * MessageBubble component for displaying a single chat message.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { stripMarkdown } from "@/lib/utils-markdown";
import { Icons } from "@/components/ui/icons";
import { ToolCardComponent } from "./ToolCard";
import type { ChatMessage, MessageContentItem } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onViewToolDetail?: (content: string) => void;
}

export function MessageBubble({ message, isStreaming = false, onViewToolDetail }: MessageBubbleProps) {
  const { role, content, timestamp } = message;

  // Normalize content to array
  const contentItems: MessageContentItem[] = Array.isArray(content)
    ? content
    : [{ type: "text", text: content } as MessageContentItem];

  const isUser = role === "user";
  const isSystem = role === "system";
  const isTool = role === "tool" || role === "tool_result";

  // Get role display info
  const getRoleInfo = () => {
    if (isUser) return { label: "You", icon: null, bgColor: "bg-accent/10", textColor: "text-foreground" };
    if (isSystem) return { label: "System", icon: Icons.circle, bgColor: "bg-muted/50", textColor: "text-muted-foreground" };
    if (isTool) return { label: "Tool", icon: Icons.wrench, bgColor: "bg-muted/50", textColor: "text-muted-foreground" };
    return { label: "Assistant", icon: Icons.brain, bgColor: "bg-card", textColor: "text-foreground" };
  };

  const roleInfo = getRoleInfo();

  // Extract text content from message
  const getTextContent = () => {
    const textItems = contentItems.filter((item) => item.type === "text");
    return textItems.map((item) => item.text || "").join("\n");
  };

  // Get tool cards from message
  const getToolCards = () => {
    const toolCards: Array<{ kind: "call" | "result"; name: string; args?: unknown; text?: string }> = [];

    for (const item of contentItems) {
      if (item.type === "tool_call") {
        toolCards.push({
          kind: "call",
          name: item.name || "tool",
          args: item.args,
        });
      }
      if (item.type === "tool_result") {
        toolCards.push({
          kind: "result",
          name: item.name || "tool",
          text: item.text,
        });
      }
    }

    return toolCards;
  };

  const textContent = getTextContent();
  const toolCards = getToolCards();
  const hasContent = textContent.trim().length > 0 || toolCards.length > 0;

  // Don't render empty messages
  if (!hasContent) return null;

  const timeString = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      {!isUser && roleInfo.icon && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${roleInfo.bgColor} flex items-center justify-center`}>
          <roleInfo.icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Message content */}
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Role label */}
        {!isUser && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">{roleInfo.label}</span>
            <span className="text-xs text-muted-foreground/50">{timeString}</span>
          </div>
        )}

        {/* Text content */}
        {textContent.trim().length > 0 && (
          <div
            className={`px-4 py-2 rounded-lg ${
              isUser
                ? "bg-accent text-accent-foreground rounded-tr-sm"
                : "bg-card border border-border/50 rounded-tl-sm"
            }`}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap break-words">{textContent}</p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    code: ({ node, inline, className, children, ...props }: any) => {
                      const match = /language-(\w+)/.exec(className || "");
                      return !inline ? (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className="px-1 py-0.5 rounded bg-muted text-muted-foreground text-xs" {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="overflow-x-auto p-3 rounded-lg bg-muted/50 border border-border/50">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Tool cards */}
        {toolCards.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {toolCards.map((card, index) => (
              <ToolCardComponent
                key={`${card.kind}-${card.name}-${index}`}
                card={card}
                onViewDetail={onViewToolDetail}
              />
            ))}
          </div>
        )}

        {/* User timestamp */}
        {isUser && (
          <span className="text-xs text-muted-foreground/50 px-1">{timeString}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Get a plain text preview of a message (e.g., for message lists)
 */
export function getMessagePreview(message: ChatMessage, maxLength = 100): string {
  const { content, role } = message;

  if (role === "user") {
    if (typeof content === "string") return content.slice(0, maxLength);
    const textItems = Array.isArray(content)
      ? content.filter((item: any) => item.type === "text").map((item: any) => item.text).join(" ")
      : "";
    return textItems.slice(0, maxLength);
  }

  if (typeof content === "string") {
    return stripMarkdown(content).slice(0, maxLength);
  }

  const textItems = Array.isArray(content)
    ? content.filter((item: any) => item.type === "text").map((item: any) => item.text).join(" ")
    : "";

  return stripMarkdown(textItems).slice(0, maxLength);
}
