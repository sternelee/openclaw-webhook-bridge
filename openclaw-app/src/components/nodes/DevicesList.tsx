/**
 * DevicesList section - Device pairing requests and paired devices management.
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

interface PendingDevice {
  requestId: string;
  deviceId: string;
  displayName?: string;
  role?: string;
  scopes: string[];
  remoteIp?: string;
  ts: number;
  isRepair: boolean;
}

interface DeviceToken {
  role: string;
  scopes: string[];
  createdAtMs: number;
  rotatedAtMs?: number;
  lastUsedAtMs?: number;
  revokedAtMs?: number;
}

interface PairedDevice {
  deviceId: string;
  displayName?: string;
  roles: string[];
  scopes: string[];
  remoteIp?: string;
  tokens: DeviceToken[];
}

// Mock data for demonstration
const MOCK_PENDING: PendingDevice[] = [
  {
    requestId: "req-1",
    deviceId: "iphone-15-pro",
    displayName: "iPhone 15 Pro",
    role: "control",
    scopes: ["exec:node", "exec:gateway", "system.run"],
    remoteIp: "192.168.1.100",
    ts: Date.now() - 300000,
    isRepair: false,
  },
];

const MOCK_PAIRED: PairedDevice[] = [
  {
    deviceId: "macbook-pro-m1",
    displayName: "MacBook Pro M1",
    roles: ["control", "exec"],
    scopes: ["exec:node", "exec:gateway", "system.run", "system.execApprovals.get"],
    remoteIp: "192.168.1.50",
    tokens: [
      {
        role: "control",
        scopes: ["exec:node", "exec:gateway"],
        createdAtMs: Date.now() - 86400000,
        rotatedAtMs: Date.now() - 3600000,
        lastUsedAtMs: Date.now() - 1800000,
      },
      {
        role: "exec",
        scopes: ["system.run"],
        createdAtMs: Date.now() - 86400000,
        lastUsedAtMs: Date.now() - 90000000,
      },
    ],
  },
  {
    deviceId: "pixel-8",
    displayName: "Google Pixel 8",
    roles: ["control"],
    scopes: ["exec:node"],
    remoteIp: "192.168.1.75",
    tokens: [
      {
        role: "control",
        scopes: ["exec:node"],
        createdAtMs: Date.now() - 172800000,
        lastUsedAtMs: Date.now() - 86400000,
      },
    ],
  },
];

export function DevicesList() {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingDevice[]>(MOCK_PENDING);
  const [paired, setPaired] = useState<PairedDevice[]>(MOCK_PAIRED);
  const [error, setError] = useState<string | null>(null);

  const formatAgo = (timestamp?: number): string => {
    if (!timestamp) return "never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatList = (items: string[]): string => {
    if (items.length === 0) return "none";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleApprove = (requestId: string) => {
    console.log("Approving device:", requestId);
    setPending(pending.filter((d) => d.requestId !== requestId));
    // In real implementation, this would call the API
  };

  const handleReject = (requestId: string) => {
    console.log("Rejecting device:", requestId);
    setPending(pending.filter((d) => d.requestId !== requestId));
    // In real implementation, this would call the API
  };

  const handleRotate = (deviceId: string, role: string, scopes?: string[]) => {
    console.log("Rotating token:", { deviceId, role, scopes });
    // In real implementation, this would call the API
  };

  const handleRevoke = (deviceId: string, role: string) => {
    console.log("Revoking token:", { deviceId, role });
    // In real implementation, this would call the API
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Icons.smartphone className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <CardTitle>Devices</CardTitle>
                  <CardDescription>Pairing requests + role tokens.</CardDescription>
                </div>
                {(pending.length > 0 || paired.length > 0) && (
                  <Badge variant="secondary" className="ml-2">
                    {pending.length + paired.length}
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
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger">
                {error}
              </div>
            )}

            {/* Pending Requests */}
            {pending.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Pending</h4>
                {pending.map((req) => {
                  const name = req.displayName?.trim() || req.deviceId;
                  const age = formatAgo(req.ts);
                  const role = req.role?.trim() ? `role: ${req.role}` : "role: -";
                  const repair = req.isRepair ? " · repair" : "";
                  const ip = req.remoteIp ? ` · ${req.remoteIp}` : "";

                  return (
                    <div
                      key={req.requestId}
                      className="p-4 rounded-lg border border-border/50 bg-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <h5 className="font-medium truncate">{name}</h5>
                          <p className="text-sm text-muted-foreground">
                            {req.deviceId}
                            {ip}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {role} · requested {age}
                            {repair}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(req.requestId)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(req.requestId)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paired Devices */}
            {paired.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {pending.length > 0 ? "Paired" : null}
                </h4>
                {paired.map((device) => {
                  const name = device.displayName?.trim() || device.deviceId;
                  const ip = device.remoteIp ? ` · ${device.remoteIp}` : "";
                  const roles = `roles: ${formatList(device.roles)}`;
                  const scopes = `scopes: ${formatList(device.scopes)}`;
                  const tokens = device.tokens || [];

                  return (
                    <div
                      key={device.deviceId}
                      className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-medium">{name}</h5>
                          <Badge variant="outline" className="text-xs">
                            {device.deviceId}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Icons.wifi className="h-3 w-3 mr-1" />
                            paired
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {device.deviceId}
                          {ip}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {roles} · {scopes}
                        </p>
                      </div>

                      {/* Tokens */}
                      {tokens.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          Tokens: none
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm font-medium">Tokens</div>
                          {tokens.map((token, idx) => {
                            const status = token.revokedAtMs ? "revoked" : "active";
                            const tokenScopes = `scopes: ${formatList(token.scopes)}`;
                            const when = formatAgo(
                              token.rotatedAtMs ?? token.createdAtMs ?? token.lastUsedAtMs
                            );

                            return (
                              <div
                                key={idx}
                                className="pl-4 border-l-2 border-border/50 space-y-2"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="space-y-1 text-sm">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium">{token.role}</span>
                                      <Badge
                                        variant={status === "active" ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        {status}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {tokenScopes} · {when}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleRotate(device.deviceId, token.role, token.scopes)
                                      }
                                    >
                                      Rotate
                                    </Button>
                                    {!token.revokedAtMs && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          handleRevoke(device.deviceId, token.role)
                                        }
                                      >
                                        Revoke
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {pending.length === 0 && paired.length === 0 && (
              <div className="text-center py-12">
                <Icons.smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h4 className="font-medium mb-2">No paired devices</h4>
                <p className="text-sm text-muted-foreground">
                  Devices will appear here when they request pairing.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
