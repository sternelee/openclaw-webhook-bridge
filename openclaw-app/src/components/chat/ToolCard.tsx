/**
 * ToolCard component for displaying tool calls and results.
 * Ported from /Users/sternelee/www/github/openclaw/ui/src/ui/chat/tool-cards.ts
 */

import { useState } from "react";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ToolCard } from "@/types";

const CheckIcon = Icons.check;

const TOOL_INLINE_THRESHOLD = 200;

interface ToolCardProps {
  card: ToolCard;
  onViewDetail?: (content: string) => void;
}

export function ToolCardComponent({ card, onViewDetail }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasText = Boolean(card.text?.trim());
  const isShort = hasText && (card.text?.length ?? 0) <= TOOL_INLINE_THRESHOLD;

  const handleClick = () => {
    if (!onViewDetail) return;

    if (hasText) {
      const formatted = formatToolOutputForSidebar(card.text!);
      onViewDetail(formatted);
    } else {
      const info = `## ${card.name}\n\n*No output — tool completed successfully.*`;
      onViewDetail(info);
    }
  };

  const getDisplayInfo = () => {
    const name = card.name.toLowerCase();
    if (name.includes("edit") || name.includes("write")) {
      return { label: card.name, icon: "edit" as const, color: "bg-blue-500/20 text-blue-400" };
    }
    if (name.includes("search") || name.includes("find")) {
      return { label: card.name, icon: "search" as const, color: "bg-purple-500/20 text-purple-400" };
    }
    if (name.includes("read") || name.includes("view")) {
      return { label: card.name, icon: "fileCode" as const, color: "bg-green-500/20 text-green-400" };
    }
    if (name.includes("terminal") || name.includes("command") || name.includes("exec")) {
      return { label: card.name, icon: "terminal" as const, color: "bg-orange-500/20 text-orange-400" };
    }
    if (name.includes("browse") || name.includes("http")) {
      return { label: card.name, icon: "globe" as const, color: "bg-cyan-500/20 text-cyan-400" };
    }
    return { label: card.name, icon: "wrench" as const, color: "bg-gray-500/20 text-gray-400" };
  };

  const display = getDisplayInfo();
  const IconComponent = Icons[display.icon];

  if (card.kind === "call") {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`p-1 rounded ${display.color}`}>
                <IconComponent className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium text-sm">{display.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">Calling…</span>
          </div>
        </CardHeader>
        {card.args !== undefined && (
          <CardContent className="px-3 pb-2">
            <pre className="text-xs text-muted-foreground overflow-x-auto">
              {JSON.stringify(card.args, null, 2)}
            </pre>
          </CardContent>
        )}
      </Card>
    );
  }

  // Result card
  const showInline = hasText && isShort;
  const showCollapsed = hasText && !isShort;
  const isEmpty = !hasText;

  return (
    <Card
      className={`border-border/50 bg-card/50 transition-colors ${
        onViewDetail ? "cursor-pointer hover:bg-card/80" : ""
      }`}
      onClick={onViewDetail ? handleClick : undefined}
    >
      <CardHeader className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`p-1 rounded ${display.color}`}>
              <IconComponent className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium text-sm">{display.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {onViewDetail && hasText && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                View <CheckIcon className="h-3 w-3" />
              </span>
            )}
            {isEmpty && !onViewDetail && (
              <span className="text-xs text-ok flex items-center gap-1">
                Completed <CheckIcon className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      {isEmpty && (
        <CardContent className="px-3 pb-2">
          <span className="text-xs text-muted-foreground">Completed</span>
        </CardContent>
      )}
      {showCollapsed && (
        <CardContent className="px-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <pre className="text-xs text-muted-foreground flex-1 overflow-hidden text-ellipsis">
              {getTruncatedPreview(card.text!)}
            </pre>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? "Less" : "More"}
            </Button>
          </div>
          {expanded && (
            <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto whitespace-pre-wrap">
              {card.text}
            </pre>
          )}
        </CardContent>
      )}
      {showInline && (
        <CardContent className="px-3 pb-2">
          <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
            {card.text}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

function getTruncatedPreview(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= 3 && text.length <= 150) return text;
  return text.slice(0, 150) + "...";
}

function formatToolOutputForSidebar(text: string): string {
  // Format as markdown code block
  if (text.includes("\n")) {
    return `## Tool Output\n\n\`\`\`\n${text}\n\`\`\``;
  }
  return `## Tool Output\n\n\`\`\`\n${text}\n\`\`\``;
}
