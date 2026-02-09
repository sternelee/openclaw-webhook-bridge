/**
 * SessionSelector - Dropdown to switch between chat sessions.
 */

import { useState } from "react";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SessionInfo {
  key: string;
  label: string | null;
  messageCount?: number;
  updatedAt?: number;
}

interface SessionSelectorProps {
  currentSessionKey: string;
  sessions: SessionInfo[];
  onSessionSwitch: (key: string) => void;
  onNewSession: () => void;
  loading?: boolean;
}

export function SessionSelector({
  currentSessionKey,
  sessions,
  onSessionSwitch,
  onNewSession,
  loading = false,
}: SessionSelectorProps) {
  const [open, setOpen] = useState(false);

  const currentSession = sessions.find((s) => s.key === currentSessionKey);
  const currentLabel = currentSession?.label || currentSessionKey;

  const handleSelect = (key: string) => {
    if (key !== currentSessionKey) {
      onSessionSwitch(key);
    }
    setOpen(false);
  };

  const handleNewSession = () => {
    onNewSession();
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 md:gap-2 max-w-[150px] md:max-w-[200px] h-8 md:h-auto px-2"
          disabled={loading}
        >
          <Icons.messageSquare className="h-4 w-4 flex-shrink-0" />
          <span className="truncate text-sm">{currentLabel}</span>
          <Icons.chevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">Sessions</p>
        </div>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="px-2 py-6 text-center">
            <Icons.loader className="h-4 w-4 animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-2 py-4 text-center">
            <p className="text-sm text-muted-foreground">No sessions yet</p>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {sessions.map((session) => {
              const isActive = session.key === currentSessionKey;
              const displayLabel = session.label || session.key;
              const messageText = session.messageCount
                ? `${session.messageCount} messages`
                : "Empty";

              return (
                <DropdownMenuItem
                  key={session.key}
                  onClick={() => handleSelect(session.key)}
                  className={isActive ? "bg-accent/50" : ""}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isActive ? (
                      <Icons.check className="h-4 w-4 text-ok flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 flex-shrink-0" />
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">{displayLabel}</span>
                      <span className="text-xs text-muted-foreground">{messageText}</span>
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleNewSession}
          className="gap-2 cursor-pointer touch-target"
        >
          <Icons.filePlus className="h-4 w-4" />
          <span>New Session</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
