/**
 * Overview page - Gateway status, entry points, and health summary.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/ui/icons";

export default function OverviewPage() {
  const router = useRouter();
  const { connected, hello } = useAppStore();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Gateway status, entry points, and a fast health read.
          </p>
        </div>
      </header>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl">
          {!connected ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Icons.wifiOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Not Connected</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect to the gateway to view status.
                  </p>
                  <Button variant="default" onClick={() => router.push("/config")}>
                    Go to Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Connection Status */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icons.wifi className="h-5 w-5 text-ok" />
                    Connection Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-muted-foreground">Status</dt>
                      <dd className="text-sm font-medium text-ok">Connected</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Protocol</dt>
                      <dd className="text-sm font-medium">{hello?.protocol || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Role</dt>
                      <dd className="text-sm font-medium">{hello?.auth?.role || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Scopes</dt>
                      <dd className="text-sm font-medium">{hello?.auth?.scopes?.join(", ") || "N/A"}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="cursor-pointer hover:bg-card/80 transition-colors" onClick={() => router.push("/chat")}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icons.messageSquare className="h-4 w-4" />
                      Chat
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Open the chat interface to interact with the assistant.
                    </p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-card/80 transition-colors" onClick={() => router.push("/sessions")}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icons.fileText className="h-4 w-4" />
                      Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      View and manage active sessions.
                    </p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-card/80 transition-colors" onClick={() => router.push("/config")}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icons.settings className="h-4 w-4" />
                      Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Manage gateway connection settings.
                    </p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-card/80 transition-colors" onClick={() => router.push("/logs")}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icons.scrollText className="h-4 w-4" />
                      Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      View live gateway logs.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
