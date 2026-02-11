/**
 * Config page - Connection settings configuration.
 * Configure Gateway URL, Token, and UID for WebSocket connection.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MobileNavigation, MobileHeader } from "@/components/layout";
import { Icons } from "@/components/ui/icons";
import { loadSettings, saveSettings } from "@/types/storage";

export default function ConfigPage() {
  const router = useRouter();
  const { 
    connected, 
    connecting,
    gatewayUrl: storeGatewayUrl, 
    token: storeToken, 
    uid: storeUid,
    setGatewayUrl,
    setToken,
    setUid,
    connect,
    disconnect,
  } = useAppStore();

  // Local form state
  const [gatewayUrl, setLocalGatewayUrl] = useState("");
  const [token, setLocalToken] = useState("");
  const [uid, setLocalUid] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const settings = loadSettings();
    setLocalGatewayUrl(settings.gatewayUrl || storeGatewayUrl);
    setLocalToken(settings.token || storeToken);
    setLocalUid(settings.uid || storeUid);
  }, [storeGatewayUrl, storeToken, storeUid]);

  // Check for changes
  useEffect(() => {
    const changed = 
      gatewayUrl !== storeGatewayUrl ||
      token !== storeToken ||
      uid !== storeUid;
    setHasChanges(changed);
  }, [gatewayUrl, token, uid, storeGatewayUrl, storeToken, storeUid]);

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      // Update store
      setGatewayUrl(gatewayUrl.trim());
      setToken(token.trim());
      setUid(uid.trim());

      // Save to localStorage
      const settings = loadSettings();
      saveSettings({
        ...settings,
        gatewayUrl: gatewayUrl.trim(),
        token: token.trim(),
        uid: uid.trim(),
      });

      // If connected, reconnect with new settings
      if (connected) {
        disconnect();
        setTimeout(() => {
          connect();
        }, 500);
      }

      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    const settings = loadSettings();
    setLocalGatewayUrl(settings.gatewayUrl);
    setLocalToken(settings.token);
    setLocalUid(settings.uid);
  };

  // Handle connect/disconnect
  const handleConnectionToggle = () => {
    if (connected) {
      disconnect();
    } else {
      if (hasChanges) {
        handleSave();
      } else {
        connect();
      }
    }
  };

  // Header content for mobile
  const headerContent = (
    <>
      <h1 className="text-base md:text-lg font-semibold truncate">
        Connection Settings
      </h1>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
          connected ? "bg-ok/10 text-ok" : "bg-muted/50 text-muted-foreground"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-ok animate-pulse" : ""}`}
        />
        {connected ? "Connected" : "Disconnected"}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Mobile Navigation */}
      <div className="md:hidden hidden">
        <MobileNavigation />
      </div>

      {/* Mobile Header */}
      <MobileHeader
        connected={connected}
        sending={false}
        runId={null}
        showThinking={false}
        onToggleThinking={() => {}}
        onToggleFocusMode={() => {}}
        onAbort={() => {}}
        leadingContent={headerContent}
      />

      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur">
        <div className="flex items-center gap-3">{headerContent}</div>
        <div className="flex items-center gap-2">
          <Button
            variant={connected ? "destructive" : "default"}
            size="sm"
            onClick={handleConnectionToggle}
            disabled={connecting}
          >
            {connecting ? (
              <>
                <Icons.loader className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : connected ? (
              <>
                <Icons.wifiOff className="h-4 w-4 mr-2" />
                Disconnect
              </>
            ) : (
              <>
                <Icons.wifi className="h-4 w-4 mr-2" />
                Connect
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
            {/* Connection Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {connected ? (
                    <Icons.wifi className="h-5 w-5 text-ok" />
                  ) : (
                    <Icons.wifiOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  Connection Status
                </CardTitle>
                <CardDescription>
                  {connected
                    ? "Connected to OpenClaw Gateway"
                    : "Configure settings below and click Connect"}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Connection Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Gateway Configuration</CardTitle>
                <CardDescription>
                  Configure WebSocket connection to OpenClaw Gateway or Webhook Bridge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gateway-url">
                    Gateway URL <span className="text-danger">*</span>
                  </Label>
                  <Input
                    id="gateway-url"
                    type="text"
                    placeholder="ws://localhost:18789 or wss://your-webhook.com/ws"
                    value={gatewayUrl}
                    onChange={(e) => setLocalGatewayUrl(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    WebSocket URL for OpenClaw Gateway (ws://localhost:18789) or Webhook Bridge (wss://...)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token">
                    Token <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="token"
                    type="password"
                    placeholder="Enter authentication token"
                    value={token}
                    onChange={(e) => setLocalToken(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Authentication token for Gateway access (leave empty if not required)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uid">
                    UID <span className="text-muted-foreground text-xs">(for webhook routing)</span>
                  </Label>
                  <Input
                    id="uid"
                    type="text"
                    placeholder="Enter unique identifier"
                    value={uid}
                    onChange={(e) => setLocalUid(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for routing messages via Webhook Bridge (required for webhook mode)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-accent/20 bg-accent/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Icons.info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-foreground">Connection Modes</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="text-accent">•</span>
                        <span><strong>Gateway Mode:</strong> Connect directly to OpenClaw Gateway (ws://localhost:18789)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-accent">•</span>
                        <span><strong>Webhook Mode:</strong> Connect via Cloudflare Webhook Bridge (wss://...)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-accent">•</span>
                        <span>UID is required for webhook mode to route messages correctly</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges || saving}
              >
                Reset
              </Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={!hasChanges || saving || !gatewayUrl.trim()}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Icons.loader className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icons.check className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
