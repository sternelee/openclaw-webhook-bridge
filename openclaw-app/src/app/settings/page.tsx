/**
 * Config page - Gateway connection settings.
 */

"use client";

import { useEffect, useState, useId } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/ui/icons";
import { loadSettings, saveSettings } from "@/types/storage";

export default function ConfigPage() {
  const router = useRouter();
  const gatewayUrlId = useId();
  const uidId = useId();
  const tokenId = useId();
  const [connecting, setConnecting] = useState(false);
  const {
    gatewayUrl,
    token,
    uid,
    setGatewayUrl,
    setToken,
    setUid,
    connect,
    connected,
  } = useAppStore();
  const [localUrl, setLocalUrl] = useState(gatewayUrl);
  const [localToken, setLocalToken] = useState(token);
  const [localUid, setLocalUid] = useState(uid);

  useEffect(() => {
    const settings = loadSettings();
    setLocalUrl(settings.gatewayUrl);
    setLocalToken(settings.token);
    setLocalUid(settings.uid);
    setGatewayUrl(settings.gatewayUrl);
    setToken(settings.token);
    setUid(settings.uid);
  }, [setGatewayUrl, setToken, setUid]);

  // Auto-navigate to chat when connected
  useEffect(() => {
    if (connected && connecting) {
      setConnecting(false);
      router.push("/chat");
    }
  }, [connected, connecting, router]);

  const handleSave = () => {
    const settings = loadSettings();
    settings.gatewayUrl = localUrl;
    settings.token = localToken;
    settings.uid = localUid;
    saveSettings(settings);

    setGatewayUrl(localUrl);
    setToken(localToken);
    setUid(localUid);
  };

  const handleConnect = () => {
    handleSave();
    setConnecting(true);
    connect();
  };

  const handleDisconnect = () => {
    useAppStore.getState().disconnect();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold">Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Edit ~/.openclaw/openclaw.json safely.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              <Icons.wifiOff className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleConnect}>
              <Icons.wifi className="h-4 w-4 mr-2" />
              Connect
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Gateway Connection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={gatewayUrlId}>WebSocket URL</Label>
                <Input
                  id={gatewayUrlId}
                  type="text"
                  placeholder="wss://your-worker.workers.dev/ws"
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Cloudflare Workers WebSocket URL (e.g.,
                  wss://your-worker.workers.dev/ws)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={uidId}>Bridge UID</Label>
                <Input
                  id={uidId}
                  type="text"
                  placeholder="Your bridge UID"
                  value={localUid}
                  onChange={(e) => setLocalUid(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Bridge instance UID for routing (从 bridge 生成的 UUID)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={tokenId}>Auth Token (optional)</Label>
                <Input
                  id={tokenId}
                  type="password"
                  placeholder="Enter auth token..."
                  value={localToken}
                  onChange={(e) => setLocalToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional authentication token for the gateway
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} variant="outline">
                  <Icons.check className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button onClick={handleConnect} disabled={!localUrl || connecting}>
                  <Icons.wifi className="h-4 w-4 mr-2" />
                  {connecting ? "Connecting..." : connected ? "Reconnect" : "Connect"}
                </Button>
                {connected && (
                  <Button onClick={() => router.push("/chat")}>
                    <Icons.messageSquare className="h-4 w-4 mr-2" />
                    Go to Chat
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Connection Status */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${connected ? "bg-ok animate-pulse" : "bg-muted"}`}
                />
                <span className="text-sm">
                  {connected ? "Connected to gateway" : "Not connected"}
                </span>
              </div>
              {connected && localUid && (
                <p className="text-xs text-muted-foreground mt-2">
                  UID: {localUid}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}