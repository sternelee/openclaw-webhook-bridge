/**
 * ViewSessionDialog - Shows full metadata for a single bridge session.
 */

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { useAppStore } from "@/store/use-app-store";
import { formatAgo } from "@/lib/utils-format";
import type { BridgeSessionInfo } from "@/types";

interface ViewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionKey: string | null;
  onSwitchToSession: (key: string) => void;
}

export function ViewSessionDialog({
  open,
  onOpenChange,
  sessionKey,
  onSwitchToSession,
}: ViewSessionDialogProps) {
  const getBridgeSession = useAppStore((s) => s.getBridgeSession);
  const useWebhookMode = useAppStore((s) => s.useWebhookMode);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<BridgeSessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sessionKey) {
      setInfo(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBridgeSession(sessionKey)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError("Session not found in bridge store");
        } else {
          setInfo(result);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to fetch session");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionKey, getBridgeSession]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bridge Session</DialogTitle>
          <DialogDescription>
            {sessionKey ? (
              <code className="text-xs break-all">{sessionKey}</code>
            ) : (
              "No session selected"
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icons.loaderSpin className="h-4 w-4" />
            Loading session...
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/10 text-sm">
            <Icons.alertCircle className="h-4 w-4 mt-0.5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Error</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {info && !loading && !error && (
          <div className="space-y-3 text-sm">
            <Row label="Session ID" value={info.sessionId} mono />
            <Row label="Updated" value={formatAgo(info.updatedAt)} />
            {info.lastChannel && (
              <Row label="Last channel" value={info.lastChannel} />
            )}
            {info.lastTo && <Row label="Last to" value={info.lastTo} mono />}
            {info.deliveryContext && (
              <div className="rounded-md border border-border/50 p-3 space-y-1 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Delivery Context
                </p>
                {info.deliveryContext.channel && (
                  <Row label="channel" value={info.deliveryContext.channel} />
                )}
                {info.deliveryContext.to && (
                  <Row label="to" value={info.deliveryContext.to} mono />
                )}
                {info.deliveryContext.accountId && (
                  <Row
                    label="accountId"
                    value={info.deliveryContext.accountId}
                    mono
                  />
                )}
                {info.deliveryContext.threadId && (
                  <Row
                    label="threadId"
                    value={info.deliveryContext.threadId}
                    mono
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {info && sessionKey && useWebhookMode && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onSwitchToSession(sessionKey);
                onOpenChange(false);
              }}
            >
              <Icons.messageSquare className="h-4 w-4 mr-2" />
              Open in chat
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground min-w-[110px]">{label}</span>
      <span
        className={
          mono
            ? "font-mono text-xs break-all"
            : "break-words"
        }
      >
        {value}
      </span>
    </div>
  );
}
