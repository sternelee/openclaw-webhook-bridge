/**
 * StreamingMessage component for displaying active streaming response.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Icons } from "@/components/ui/icons";

interface StreamingMessageProps {
  text: string;
  startedAt: number;
  onViewDetail?: (content: string) => void;
}

export function StreamingMessage({ text, startedAt, onViewDetail }: StreamingMessageProps) {
  const hasText = text.trim().length > 0;

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-card flex items-center justify-center">
        <Icons.brain className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Streaming content */}
      <div className="flex flex-col gap-1 max-w-[80%] items-start">
        {/* Role label */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-medium text-muted-foreground">Assistant</span>
          <span className="text-xs text-accent">Typing…</span>
        </div>

        {/* Content */}
        <div className="px-4 py-2 rounded-lg bg-card border border-border/50 rounded-tl-sm min-w-[60px]">
          {hasText ? (
            <div className="prose prose-invert prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  code: ({ node, inline, className, children, ...props }: any) => (
                    <code
                      className={
                        inline
                          ? "px-1 py-0.5 rounded bg-muted text-muted-foreground text-xs"
                          : className
                      }
                      {...props}
                    >
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="overflow-x-auto p-3 rounded-lg bg-muted/50 border border-border/50">
                      {children}
                    </pre>
                  ),
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          ) : (
            /* Typing indicator */
            <div className="flex items-center gap-1 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse delay-75" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse delay-150" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Reading indicator for when assistant is "thinking" but hasn't started streaming yet.
 */
export function ReadingIndicator() {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-card flex items-center justify-center">
        <Icons.brain className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Reading indicator */}
      <div className="flex flex-col gap-1 max-w-[80%] items-start">
        {/* Role label */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-medium text-muted-foreground">Assistant</span>
          <span className="text-xs text-accent">Reading…</span>
        </div>

        {/* Typing indicator */}
        <div className="px-4 py-2 rounded-lg bg-card border border-border/50 rounded-tl-sm">
          <div className="flex items-center gap-1 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse delay-75" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse delay-150" />
          </div>
        </div>
      </div>
    </div>
  );
}
