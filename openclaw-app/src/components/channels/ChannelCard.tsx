/**
 * Generic channel card component for displaying channel status.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { ChannelStatus } from "./types";

interface ChannelCardProps {
  name: string;
  icon: keyof typeof Icons;
  description?: string;
  status?: ChannelStatus;
  accountCount?: number;
  children?: React.ReactNode;
}

export function ChannelCard({
  name,
  icon,
  description,
  status,
  accountCount,
  children,
}: ChannelCardProps) {
  const Icon = Icons[icon];

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

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {accountCount !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {accountCount} {accountCount === 1 ? "account" : "accounts"}
            </Badge>
          )}
        </div>
        {status && status !== "unknown" && (
          <Badge variant="outline" className={cn("mt-2 w-fit", getStatusColor(status))}>
            {status === "ok" && "Connected"}
            {status === "warn" && "Warning"}
            {status === "danger" && "Error"}
          </Badge>
        )}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}
