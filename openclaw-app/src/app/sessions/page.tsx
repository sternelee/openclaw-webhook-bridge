/**
 * Sessions page - Bridge session management UI.
 *
 * Lists, inspects, resets, and deletes sessions stored in the Rust Bridge
 * (the third session layer that maps webhook messages to OpenClaw sessionKeys).
 * Only available in webhook/bridge connection mode.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { toast } from "sonner";
import {
  BridgeSessionsTable,
  ViewSessionDialog,
  ConfirmDialog,
} from "@/components/sessions";
import { subtitleForTab } from "@/lib/navigation";

export default function SessionsPage() {
  const router = useRouter();
  const {
    connected,
    useWebhookMode,
    bridgeSessions,
    bridgeSessionsLoading,
    bridgeSessionsError,
    loadBridgeSessions,
    resetBridgeSession,
    deleteBridgeSession,
    switchSession,
  } = useAppStore();

  const [viewKey, setViewKey] = useState<string | null>(null);
  const [confirmResetKey, setConfirmResetKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load on mount when in webhook mode and connected
  useEffect(() => {
    if (connected && useWebhookMode) {
      void loadBridgeSessions();
    }
  }, [connected, useWebhookMode, loadBridgeSessions]);

  const handleRefresh = useCallback(() => {
    void loadBridgeSessions();
  }, [loadBridgeSessions]);

  const handleSwitchToSession = useCallback(
    (key: string) => {
      switchSession(key);
      toast.success(`Switched to session ${key}`);
      router.push("/chat");
    },
    [switchSession, router],
  );

  const handleConfirmReset = useCallback(async () => {
    if (!confirmResetKey) return;
    setActionLoading(true);
    try {
      const result = await resetBridgeSession(confirmResetKey);
      if (result.success) {
        toast.success(`Reset ${confirmResetKey}`);
      } else {
        toast.error(`Reset failed: ${result.error ?? "unknown error"}`);
      }
    } finally {
      setActionLoading(false);
      setConfirmResetKey(null);
    }
  }, [confirmResetKey, resetBridgeSession]);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteKey) return;
    setActionLoading(true);
    try {
      const result = await deleteBridgeSession(confirmDeleteKey);
      if (result.success) {
        toast.success(`Deleted ${confirmDeleteKey}`);
      } else {
        toast.error(`Delete failed: ${result.error ?? "unknown error"}`);
      }
    } finally {
      setActionLoading(false);
      setConfirmDeleteKey(null);
    }
  }, [confirmDeleteKey, deleteBridgeSession]);

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur">
          <div>
            <h1 className="text-xl font-semibold">Bridge Sessions</h1>
            <p className="text-sm text-muted-foreground">
              {subtitleForTab("sessions")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                connected
                  ? "bg-ok/10 text-ok"
                  : "bg-muted/50 text-muted-foreground"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? "bg-ok animate-pulse" : ""
                }`}
              />
              {connected ? "Connected" : "Disconnected"}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={!connected || !useWebhookMode || bridgeSessionsLoading}
            >
              <Icons.refreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {!connected && (
            <EmptyState
              icon={<Icons.wifiOff className="h-10 w-10" />}
              title="Not connected"
              description="Connect to a gateway or bridge first."
              action={
                <Button onClick={() => router.push("/settings")}>
                  Go to Settings
                </Button>
              }
            />
          )}

          {connected && !useWebhookMode && (
            <EmptyState
              icon={<Icons.alertCircle className="h-10 w-10" />}
              title="Direct gateway mode"
              description="Bridge session control is only available in webhook/bridge mode. Sessions listed here are maintained by the Rust Bridge and are not visible when connecting directly to the OpenClaw Gateway."
              action={
                <Button
                  variant="outline"
                  onClick={() => router.push("/settings")}
                >
                  Switch connection
                </Button>
              }
            />
          )}

          {connected && useWebhookMode && (
            <>
              {bridgeSessionsError && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/10 text-sm">
                  <Icons.alertCircle className="h-4 w-4 mt-0.5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      Failed to load sessions
                    </p>
                    <p className="text-muted-foreground">
                      {bridgeSessionsError}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {bridgeSessions.length === 0
                      ? "No sessions"
                      : `${bridgeSessions.length} session${bridgeSessions.length === 1 ? "" : "s"}`}
                  </span>
                  <span>
                    Click a row&apos;s icons to view / reset / delete.
                  </span>
                </div>
                <BridgeSessionsTable
                  sessions={bridgeSessions}
                  loading={bridgeSessionsLoading}
                  onView={(key) => setViewKey(key)}
                  onReset={(key) => setConfirmResetKey(key)}
                  onDelete={(key) => setConfirmDeleteKey(key)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <ViewSessionDialog
        open={viewKey !== null}
        onOpenChange={(o) => !o && setViewKey(null)}
        sessionKey={viewKey}
        onSwitchToSession={handleSwitchToSession}
      />

      <ConfirmDialog
        open={confirmResetKey !== null}
        onOpenChange={(o) => !o && setConfirmResetKey(null)}
        title="Reset session?"
        description={
          confirmResetKey ? (
            <>
              This will mint a new <code>sessionId</code> for{" "}
              <code className="break-all">{confirmResetKey}</code>. The
              conversation context in OpenClaw will be discarded. Webhook
              routing and delivery context are preserved.
            </>
          ) : undefined
        }
        confirmLabel="Reset"
        loading={actionLoading}
        onConfirm={handleConfirmReset}
      />

      <ConfirmDialog
        open={confirmDeleteKey !== null}
        onOpenChange={(o) => !o && setConfirmDeleteKey(null)}
        title="Delete session?"
        description={
          confirmDeleteKey ? (
            <>
              This will remove{" "}
              <code className="break-all">{confirmDeleteKey}</code> from the
              bridge session store. The session cannot be recovered.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center max-w-md px-4">
        <div className="text-muted-foreground mx-auto mb-4 w-fit">
          {icon}
        </div>
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        {action}
      </div>
    </div>
  );
}
