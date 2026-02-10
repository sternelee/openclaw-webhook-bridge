/**
 * MobileHeader component - Responsive header with mobile overflow menu.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  connected: boolean;
  sending: boolean;
  runId: string | null;
  showThinking: boolean;
  onToggleThinking: () => void;
  onToggleFocusMode: () => void;
  onAbort: () => void;
  leadingContent?: React.ReactNode;
}

export function MobileHeader({
  connected,
  sending,
  runId,
  showThinking,
  onToggleThinking,
  onToggleFocusMode,
  onAbort,
  leadingContent,
}: MobileHeaderProps) {
  const [abortAnimating, setAbortAnimating] = useState(false);

  const handleAbort = () => {
    setAbortAnimating(true);
    onAbort();
    setTimeout(() => setAbortAnimating(false), 500);
  };

  return (
    <header className="flex items-center justify-between px-3 md:px-4 py-0 md:py-3 border-b border-border/50 bg-card/50 backdrop-blur safe-area-top">
      {/* Left side - menu button and title */}
      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
        {/* Mobile menu button - shown on mobile only */}
        <div className="md:hidden">
          {/* MobileNavigation will be rendered by the parent */}
        </div>

        {/* Title and leading content */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {leadingContent}
        </div>
      </div>

      {/* Right side - action buttons */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Abort button when streaming */}
        {sending && runId && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleAbort}
            className={cn(
              "gap-1 touch-target",
              abortAnimating && "animate-pulse",
            )}
            title="Stop the current response"
          >
            <Icons.x className="h-4 w-4" />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        )}

        {/* Connection status - compact on mobile */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
            connected
              ? "bg-ok/10 text-ok"
              : "bg-muted/50 text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              connected && "bg-ok animate-pulse",
            )}
          />
          <span className="hidden sm:inline">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* Desktop-only buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleThinking}
            className={cn("gap-1", showThinking && "bg-accent/10")}
            title={showThinking ? "Hide thinking" : "Show thinking"}
          >
            <Icons.brain className="h-4 w-4" />
            Thinking
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFocusMode}
            className="gap-1"
          >
            <Icons.maximize className="h-4 w-4" />
            Focus
          </Button>
        </div>

        {/* Mobile overflow menu */}
        <div className="md:hidden hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="touch-target">
                <Icons.moreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={onToggleThinking}
                className={cn(
                  "gap-2 cursor-pointer touch-target",
                  showThinking && "bg-accent/10",
                )}
              >
                <Icons.brain className="h-4 w-4" />
                <span>{showThinking ? "Hide" : "Show"} Thinking</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onToggleFocusMode}
                className="gap-2 cursor-pointer touch-target"
              >
                <Icons.maximize className="h-4 w-4" />
                <span>Focus Mode</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
