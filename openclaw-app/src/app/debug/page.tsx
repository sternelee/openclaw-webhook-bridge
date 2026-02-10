'use client';

/**
 * Debug page - Gateway snapshots, events, and manual RPC calls.
 * Ported from /Users/sternelee/www/github/openclaw/ui/src/ui/views/debug.ts
 */

import { useState } from 'react';
import { useAppStore } from '@/store/use-app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icons } from '@/components/ui/icons';

export default function DebugPage() {
  const { connected, hello, client, eventLog } = useAppStore();
  const [rpcMethod, setRpcMethod] = useState('system.listCommands');
  const [rpcParams, setRpcParams] = useState('{}');
  const [rpcResult, setRpcResult] = useState<any>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [rpcLoading, setRpcLoading] = useState(false);

  const handleCallRpc = async () => {
    if (!connected || !client) {
      setRpcError('Not connected to gateway');
      return;
    }

    setRpcLoading(true);
    setRpcError(null);
    setRpcResult(null);

    try {
      const params = rpcParams ? JSON.parse(rpcParams) : undefined;
      // This will need to be implemented in the GatewayClient
      const result = await (client as any).callRpc(rpcMethod, params);
      setRpcResult(result);
    } catch (error) {
      setRpcError(error instanceof Error ? error.message : 'RPC call failed');
    } finally {
      setRpcLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold">Debug</h1>
          <p className="text-sm text-muted-foreground">
            Gateway snapshots, events, and manual RPC calls.
          </p>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 space-y-6 max-w-4xl">
            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle>Connection</CardTitle>
                <CardDescription>Current gateway connection status</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">Status</dt>
                    <dd className="text-sm font-medium">
                      {connected ? (
                        <span className="text-ok">Connected</span>
                      ) : (
                        <span className="text-muted">Disconnected</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Protocol</dt>
                    <dd className="text-sm font-mono">{hello?.protocol || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Protocol Version</dt>
                    <dd className="text-sm font-mono">{hello?.protocol ?? 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Features</dt>
                    <dd className="text-sm font-mono">
                      {hello?.features ? `${hello.features.methods?.length || 0} methods` : 'N/A'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Manual RPC Call */}
            <Card>
              <CardHeader>
                <CardTitle>Manual RPC Call</CardTitle>
                <CardDescription>Send raw RPC requests to the gateway</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rpc-method">Method</Label>
                  <Input
                    id="rpc-method"
                    placeholder="system.listCommands"
                    value={rpcMethod}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRpcMethod(e.target.value)}
                    disabled={!connected || rpcLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rpc-params">Parameters (JSON)</Label>
                  <Input
                    id="rpc-params"
                    placeholder='{"key": "value"}'
                    value={rpcParams}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRpcParams(e.target.value)}
                    disabled={!connected || rpcLoading}
                  />
                </div>

                <Button
                  onClick={handleCallRpc}
                  disabled={!connected || rpcLoading}
                  className="w-full md:w-auto"
                >
                  {rpcLoading ? (
                    <>
                      <Icons.loader className="mr-2 h-4 w-4 animate-spin" />
                      Calling...
                    </>
                  ) : (
                    <>
                      <Icons.terminal className="mr-2 h-4 w-4" />
                      Call RPC
                    </>
                  )}
                </Button>

                {rpcError && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      <Icons.alertCircle className="inline mr-2 h-4 w-4" />
                      {rpcError}
                    </p>
                  </div>
                )}

                {rpcResult && (
                  <div className="space-y-2">
                    <Label>Result</Label>
                    <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                      {JSON.stringify(rpcResult, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Event Log */}
            <Card>
              <CardHeader>
                <CardTitle>Event Log</CardTitle>
                <CardDescription>Recent gateway events (last 250)</CardDescription>
              </CardHeader>
              <CardContent>
                {eventLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events yet</p>
                ) : (
                  <ScrollArea className="h-64 w-full rounded-md border">
                    <div className="p-2 space-y-1">
                      {eventLog.map((entry, idx) => (
                        <div key={idx} className="text-xs font-mono">
                          <span className="text-muted-foreground">
                            {new Date(entry.ts).toLocaleTimeString()}:
                          </span>{' '}
                          <span>{entry.event}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Common Commands */}
            <Card>
              <CardHeader>
                <CardTitle>Common Commands</CardTitle>
                <CardDescription>Quick access to useful gateway commands</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {['system.listCommands', 'system.status', 'agent.list', 'session.list'].map((cmd) => (
                    <Button
                      key={cmd}
                      variant="outline"
                      size="sm"
                      onClick={() => setRpcMethod(cmd)}
                      disabled={!connected}
                    >
                      {cmd}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
