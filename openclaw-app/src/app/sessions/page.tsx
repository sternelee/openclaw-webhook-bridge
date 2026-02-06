/**
 * Sessions page - Manage and inspect active sessions.
 * Ported from /Users/sternelee/www/github/openclaw/ui/src/ui/views/sessions.ts
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icons } from "@/components/ui/icons";
import { formatDistanceToNow } from "date-fns";

const REASONING_LEVELS = ["off", "low", "medium", "high"];

export default function SessionsPage() {
  const router = useRouter();
  const {
    connected,
    sessions,
    sessionsLoading,
    sessionsError,
    sessionKey,
    loadSessions,
    patchSession,
    deleteSession,
  } = useAppStore();

  const [filterActive, setFilterActive] = useState("");
  const [filterLimit, setFilterLimit] = useState("");
  const [includeGlobal, setIncludeGlobal] = useState(false);

  useEffect(() => {
    if (connected) {
      loadSessions();
    }
  }, [connected]);

  const handleLoadSessions = () => {
    loadSessions();
  };

  const handleDeleteSession = async (key: string) => {
    if (confirm(`Delete session "${key}"?\n\nDeletes the session entry and archives its transcript.`)) {
      await deleteSession(key);
    }
  };

  const handlePatchSession = async (key: string, patch: { reasoningLevel?: string | null }) => {
    await patchSession(key, patch);
  };

  const handleOpenChat = (key: string) => {
    router.push(`/chat?session=${key}`);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Inspect active sessions and adjust per-session defaults.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleLoadSessions} disabled={!connected || sessionsLoading}>
            <Icons.refreshCw className={`h-4 w-4 mr-2 ${sessionsLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-6">
            {!connected && (
              <Card className="mb-6">
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Icons.wifiOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Not Connected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect to the gateway to view sessions.
                    </p>
                    <Button variant="default" onClick={() => router.push("/config")}>
                      Go to Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {sessionsError && (
              <Card className="mb-6 border-danger/50 bg-danger/5">
                <CardContent className="p-4">
                  <p className="text-sm text-danger">{sessionsError}</p>
                </CardContent>
              </Card>
            )}

            {connected && sessions && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Sessions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{sessions.count}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Model
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">
                        {sessions.defaults.model || "Not set"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Context Tokens
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">
                        {sessions.defaults.contextTokens?.toLocaleString() || "Not set"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Sessions table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Sessions</CardTitle>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Limit"
                          value={filterLimit}
                          onChange={(e) => setFilterLimit(e.target.value)}
                          className="w-20 h-8"
                        />
                        <Label htmlFor="include-global" className="flex items-center gap-2 cursor-pointer">
                          <input
                            id="include-global"
                            type="checkbox"
                            checked={includeGlobal}
                            onChange={(e) => setIncludeGlobal(e.target.checked)}
                            className="rounded"
                          />
                          Include global
                        </Label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session Key</TableHead>
                          <TableHead>Label</TableHead>
                          <TableHead>Kind</TableHead>
                          <TableHead>Messages</TableHead>
                          <TableHead>Tokens</TableHead>
                          <TableHead>Reasoning</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.sessions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                              No sessions found
                            </TableCell>
                          </TableRow>
                        ) : (
                          sessions.sessions.map((session) => (
                            <TableRow key={session.key}>
                              <TableCell className="font-mono text-sm">{session.key}</TableCell>
                              <TableCell>{session.label || "-"}</TableCell>
                              <TableCell>{session.kind}</TableCell>
                              <TableCell>{session.messageCount}</TableCell>
                              <TableCell>{session.totalTokens?.toLocaleString() || "-"}</TableCell>
                              <TableCell>
                                <Select
                                  value={session.reasoningLevel || "off"}
                                  onValueChange={(value) =>
                                    handlePatchSession(session.key, { reasoningLevel: value })
                                  }
                                >
                                  <SelectTrigger className="h-7 w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {REASONING_LEVELS.map((level) => (
                                      <SelectItem key={level} value={level}>
                                        {level}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {session.updatedAt
                                  ? formatDistanceToNow(new Date(session.updatedAt), {
                                      addSuffix: true,
                                    })
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenChat(session.key)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Icons.messageSquare className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSession(session.key)}
                                    className="h-7 w-7 p-0 text-danger hover:text-danger"
                                  >
                                    <Icons.trash className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
