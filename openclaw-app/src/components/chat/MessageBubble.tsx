/**
 * MessageBubble component for displaying a single chat message.
 * Enhanced with thinking/reasoning support from official OpenClaw UI.
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { stripMarkdown } from "@/lib/utils-markdown";
import { copyToClipboard } from "@/lib/utils-chat";
import {
  messageToMarkdown,
  extractText,
  extractThinking,
  formatReasoningMarkdown,
  extractImages,
  getRoleDisplayInfo,
  normalizeRoleForGrouping,
} from "@/lib/utils-message";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { ToolCardComponent } from "./ToolCard";
import type { ChatMessage, MessageContentItem } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onViewToolDetail?: (content: string) => void;
  showHeader?: boolean; // Whether to show role header and avatar
}

export function MessageBubble({
  message,
  isStreaming = false,
  onViewToolDetail,
  showHeader = false,
}: MessageBubbleProps) {
  const { role, content, timestamp } = message;
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  // Normalize content to array
  const contentItems: MessageContentItem[] = Array.isArray(content)
    ? content
    : [{ type: "text", text: content } as MessageContentItem];

  const isUser = role === "user";
  const isSystem = role === "system";
  const isTool = role === "tool" || role === "tool_result";

  // Get role display info
  const getRoleInfo = () => {
    if (isUser)
      return {
        label: "You",
        icon: null,
        bgColor: "bg-accent/10",
        textColor: "text-foreground",
      };
    if (isSystem)
      return {
        label: "System",
        icon: Icons.circle,
        bgColor: "bg-muted/50",
        textColor: "text-muted-foreground",
      };
    if (isTool)
      return {
        label: "Tool",
        icon: Icons.wrench,
        bgColor: "bg-muted/50",
        textColor: "text-muted-foreground",
      };
    return {
      label: "Assistant",
      icon: Icons.brain,
      bgColor: "bg-card",
      textColor: "text-foreground",
    };
  };

  const roleInfo = getRoleInfo();

  // Extract text content from message
  const getTextContent = () => {
    const textItems = contentItems.filter((item) => item.type === "text");
    return textItems.map((item) => item.text || "").join("\n");
  };

  // Extract thinking/reasoning from message
  const thinkingContent = extractThinking(message);
  const hasThinking = thinkingContent && thinkingContent.trim().length > 0;

  // Extract images from message
  const images = extractImages(message);
  const hasImages = images.length > 0;

  // Get tool cards from message
  const getToolCards = () => {
    const toolCards: Array<{
      kind: "call" | "result";
      name: string;
      args?: unknown;
      text?: string;
    }> = [];

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
  if (!hasContent && !hasThinking && !hasImages) return null;

  const timeString = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
  });

  const handleCopy = async () => {
    const markdown = messageToMarkdown(message);
    const success = await copyToClipboard(markdown);

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
      className={`${showHeader ? "flex gap-3" : ""} ${isUser && showHeader ? "flex-row-reverse" : ""} ${showHeader ? "group" : ""}`}
    >
      {/* Avatar - only show when showHeader is true */}
      {showHeader && !isUser && roleInfo.icon && (
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full ${roleInfo.bgColor} flex items-center justify-center`}
        >
          <roleInfo.icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Message content */}
      <div
        className={`flex flex-col gap-1 ${showHeader ? "max-w-[80%]" : "w-full"} ${isUser ? "items-end" : "items-start"}`}
      >
        {/* Role label with copy button - only show when showHeader is true */}
        {showHeader && !isUser && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">
              {roleInfo.label}
            </span>
            <span className="text-xs text-muted-foreground/50">
              {timeString}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleCopy}
              title={
                copied
                  ? "Copied!"
                  : copyError
                    ? "Copy failed"
                    : "Copy as markdown"
              }
            >
              {copied ? (
                <Icons.check className="h-3 w-3 text-ok" />
              ) : copyError ? (
                <Icons.x className="h-3 w-3 text-destructive" />
              ) : (
                <Icons.copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}

        {/* Thinking/Reasoning display */}
        {hasThinking && (
          <div className="px-4 py-2 rounded-lg bg-muted/50 border border-border/50">
            <button
              type="button"
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <Icons.brain className="h-4 w-4" />
              <span>Thinking</span>
              <span className="transform transition-transform">
                {showThinking ? "▼" : "▶"}
              </span>
            </button>
            {showThinking && (
              <div className="prose prose-invert prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {formatReasoningMarkdown(thinkingContent)}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Images display */}
        {hasImages && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((img, index) => (
              <img
                key={index}
                src={img.url}
                alt={img.alt || "Attached image"}
                className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(img.url, "_blank")}
              />
            ))}
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
              <p className="text-sm whitespace-pre-wrap break-words">
                {textContent}
              </p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    code: ({
                      node,
                      inline,
                      className,
                      children,
                      ...props
                    }: any) => {
                      const match = /language-(\w+)/.exec(className || "");
                      const language = match ? match[1] : "text";
                      const codeString = String(children).replace(/\n$/, "");

                      return !inline ? (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={language}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: "0.5rem",
                            fontSize: "0.875rem",
                            lineHeight: "1.5",
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            },
                          }}
                          showLineNumbers={codeString.split("\n").length > 5}
                          {...props}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      ) : (
                        <code
                          className="px-1 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <div className="my-4 overflow-hidden rounded-lg border border-border/50">
                        {children}
                      </div>
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
          <span className="text-xs text-muted-foreground/50 px-1">
            {timeString}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Get a plain text preview of a message (e.g., for message lists)
 */
export function getMessagePreview(
  message: ChatMessage,
  maxLength = 100,
): string {
  const { content, role } = message;

  if (role === "user") {
    if (typeof content === "string") return content.slice(0, maxLength);
    const textItems = Array.isArray(content)
      ? content
          .filter((item: any) => item.type === "text")
          .map((item: any) => item.text)
          .join(" ")
      : "";
    return textItems.slice(0, maxLength);
  }

  if (typeof content === "string") {
    return stripMarkdown(content).slice(0, maxLength);
  }

  const textItems = Array.isArray(content)
    ? content
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.text)
        .join(" ")
    : "";

  return stripMarkdown(textItems).slice(0, maxLength);
}
