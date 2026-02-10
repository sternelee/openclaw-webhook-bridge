/**
 * Account card component for displaying individual channel accounts.
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { ChannelStatus } from "./types";

interface AccountCardProps {
  name: string;
  accountId: string;
  status: ChannelStatus;
  lastInbound?: string;
  lastError?: string;
}

export function AccountCard({
  name,
  accountId,
  status,
  lastInbound,
  lastError,
}: AccountCardProps) {
  const getStatusColor = (s: ChannelStatus) => {
    switch (s) {
      case "ok":
        return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
      case "warn":
        return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
      case "danger":
        return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (s: ChannelStatus) => {
    switch (s) {
      case "ok":
        return "Connected";
      case "warn":
        return "Warning";
      case "danger":
        return "Error";
      default:
        return "Unknown";
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icons.user className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="font-medium truncate">{name}</p>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate ml-6">
              {accountId}
            </p>
            {lastInbound && (
              <p className="text-xs text-muted-foreground mt-2 ml-6">
                Last message: {lastInbound}
              </p>
            )}
            {lastError && (
              <p className="text-xs text-destructive mt-1 ml-6 flex items-start gap-1">
                <Icons.alertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{lastError}</span>
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0", getStatusColor(status))}
          >
            {getStatusLabel(status)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
