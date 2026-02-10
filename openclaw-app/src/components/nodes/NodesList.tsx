/**
 * NodesList section - Live nodes from the gateway with connection status.
 */

"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface LiveNode {
  nodeId: string;
  displayName?: string;
  remoteIp?: string;
  version?: string;
  platform?: string;
  connected: boolean;
  paired: boolean;
  caps: string[];
  commands: string[];
}

// Mock data for demonstration
const MOCK_NODES: LiveNode[] = [
  {
    nodeId: "macbook-pro-m1",
    displayName: "MacBook Pro M1",
    remoteIp: "192.168.1.50",
    version: "0.2.3",
    platform: "darwin",
    connected: true,
    paired: true,
    caps: ["exec:node", "exec:gateway", "system.run", "system.execApprovals.get"],
    commands: ["system.run", "system.execApprovals.get", "system.execApprovals.set"],
  },
  {
    nodeId: "dev-server-01",
    displayName: "Development Server",
    remoteIp: "192.168.1.10",
    version: "0.2.2",
    platform: "linux",
    connected: true,
    paired: true,
    caps: ["exec:node", "system.run"],
    commands: ["system.run"],
  },
  {
    nodeId: "work-laptop",
    displayName: "Work Laptop",
    remoteIp: "10.0.0.50",
    version: "0.2.1",
    platform: "windows",
    connected: false,
    paired: true,
    caps: ["exec:node"],
    commands: ["system.run"],
  },
  {
    nodeId: "raspberry-pi-4",
    displayName: "Raspberry Pi 4",
    version: "0.2.3",
    platform: "linux",
    connected: false,
    paired: false,
    caps: ["exec:node"],
    commands: ["system.run"],
  },
];

export function NodesList() {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<LiveNode[]>(MOCK_NODES);

  const handleRefresh = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case "darwin":
        return <Icons.maximize className="h-3 w-3" />;
      case "windows":
        return <Icons.maximize className="h-3 w-3" />;
      case "linux":
        return <Icons.terminal className="h-3 w-3" />;
      default:
        return <Icons.circle className="h-3 w-3" />;
    }
  };

  const getStatusVariant = (connected: boolean): "default" | "secondary" => {
    return connected ? "default" : "secondary";
  };

  const getStatusColor = (connected: boolean): string => {
    return connected ? "text-ok" : "text-muted-foreground";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Icons.monitor className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <CardTitle>Nodes</CardTitle>
                  <CardDescription>Paired devices and live links.</CardDescription>
                </div>
                {nodes.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {nodes.filter((n) => n.connected).length} / {nodes.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefresh();
                  }}
                  disabled={loading}
                >
                  <Icons.refreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Icons.chevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            {nodes.length === 0 ? (
              <div className="text-center py-12">
                <Icons.monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h4 className="font-medium mb-2">No nodes found</h4>
                <p className="text-sm text-muted-foreground">
                  Nodes will appear here when they connect to the gateway.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {nodes.map((node) => {
                  const title =
                    node.displayName?.trim() ||
                    (node.nodeId ? node.nodeId : "unknown");
                  const connected = node.connected;
                  const paired = node.paired;
                  const caps = node.caps || [];
                  const commands = node.commands || [];

                  return (
                    <div
                      key={node.nodeId}
                      className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-3">
                        {/* Title and ID */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-medium truncate">{title}</h5>
                              {node.platform && (
                                <span className="flex items-center text-muted-foreground">
                                  {getPlatformIcon(node.platform)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                              <span className="font-mono text-xs">{node.nodeId}</span>
                              {node.remoteIp && (
                                <span>· {node.remoteIp}</span>
                              )}
                              {node.version && (
                                <span>· {node.version}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={paired ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {paired ? "paired" : "unpaired"}
                            </Badge>
                            <Badge
                              variant={getStatusVariant(connected)}
                              className={`text-xs ${
                                connected
                                  ? "bg-ok/10 text-ok border-ok/30"
                                  : "bg-muted-foreground/10"
                              }`}
                            >
                              <div
                                className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                                  connected ? "bg-ok" : "bg-muted-foreground"
                                }`}
                              />
                              {connected ? "connected" : "offline"}
                            </Badge>
                          </div>
                        </div>

                        {/* Capabilities and Commands */}
                        {(caps.length > 0 || commands.length > 0) && (
                          <div className="flex flex-wrap gap-1.5">
                            {caps.slice(0, 12).map((cap, idx) => (
                              <Badge
                                key={`cap-${idx}`}
                                variant="outline"
                                className="text-xs font-mono"
                              >
                                {cap}
                              </Badge>
                            ))}
                            {commands.slice(0, 8).map((cmd, idx) => (
                              <Badge
                                key={`cmd-${idx}`}
                                variant="secondary"
                                className="text-xs font-mono"
                              >
                                {cmd}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
