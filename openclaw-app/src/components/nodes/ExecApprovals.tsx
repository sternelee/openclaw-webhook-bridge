/**
 * ExecApprovals section - Allowlist and approval policy for exec commands.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Icons } from "@/components/ui/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ExecSecurity = "deny" | "allowlist" | "full";
type ExecAsk = "off" | "on-miss" | "always";

interface SecurityOption {
  value: ExecSecurity;
  label: string;
}

interface AskOption {
  value: ExecAsk;
  label: string;
}

interface AllowlistEntry {
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

interface AgentOption {
  id: string;
  name?: string;
  isDefault?: boolean;
}

interface TargetNode {
  id: string;
  label: string;
}

const SECURITY_OPTIONS: SecurityOption[] = [
  { value: "deny", label: "Deny" },
  { value: "allowlist", label: "Allowlist" },
  { value: "full", label: "Full" },
];

const ASK_OPTIONS: AskOption[] = [
  { value: "off", label: "Off" },
  { value: "on-miss", label: "On miss" },
  { value: "always", label: "Always" },
];

// Mock data for demonstration
const MOCK_AGENTS: AgentOption[] = [
  { id: "main", name: "Main", isDefault: true },
  { id: "coder", name: "Coder" },
  { id: "analyst", name: "Analyst" },
];

const MOCK_NODES: TargetNode[] = [
  { id: "node-1", label: "MacBook Pro" },
  { id: "node-2", label: "Development Server" },
];

const MOCK_ALLOWLIST: AllowlistEntry[] = [
  {
    pattern: "git*",
    lastUsedAt: Date.now() - 3600000,
    lastUsedCommand: "git status",
    lastResolvedPath: "/usr/bin/git",
  },
  {
    pattern: "npm*",
    lastUsedAt: Date.now() - 86400000,
    lastUsedCommand: "npm test",
    lastResolvedPath: "/usr/local/bin/npm",
  },
];

export function ExecApprovals() {
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState<"gateway" | "node">("gateway");
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<string>("__defaults__");
  const [security, setSecurity] = useState<ExecSecurity>("deny");
  const [ask, setAsk] = useState<ExecAsk>("on-miss");
  const [askFallback, setAskFallback] = useState<ExecSecurity>("deny");
  const [autoAllowSkills, setAutoAllowSkills] = useState(false);
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>(MOCK_ALLOWLIST);

  const formatAgo = (timestamp?: number): string => {
    if (!timestamp) return "never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleSave = () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      console.log("Saved exec approvals:", {
        target,
        targetNodeId,
        selectedScope,
        security,
        ask,
        askFallback,
        autoAllowSkills,
        allowlist,
      });
    }, 1000);
  };

  const handleAddPattern = () => {
    setAllowlist([...allowlist, { pattern: "" }]);
  };

  const handleRemovePattern = (index: number) => {
    if (allowlist.length <= 1) {
      setAllowlist([]);
    } else {
      setAllowlist(allowlist.filter((_, i) => i !== index));
    }
  };

  const handleUpdatePattern = (index: number, value: string) => {
    const updated = [...allowlist];
    updated[index] = { ...updated[index], pattern: value };
    setAllowlist(updated);
  };

  const isDefaults = selectedScope === "__defaults__";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Icons.shield className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <CardTitle>Exec Approvals</CardTitle>
                  <CardDescription>
                    Allowlist and approval policy for{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">exec host=gateway/node</code>
                  </CardDescription>
                </div>
              </div>
              <Icons.chevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Target Selection */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-medium">Target</h4>
                  <p className="text-sm text-muted-foreground">
                    Gateway edits local approvals; node edits the selected node.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={target} onValueChange={(v: "gateway" | "node") => setTarget(v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gateway">Gateway</SelectItem>
                      <SelectItem value="node">Node</SelectItem>
                    </SelectContent>
                  </Select>
                  {target === "node" && (
                    <Select
                      value={targetNodeId || ""}
                      onValueChange={setTargetNodeId}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Select node" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_NODES.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-3">
              <span className="text-sm font-medium">Scope</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={isDefaults ? "default" : "outline"}
                  onClick={() => setSelectedScope("__defaults__")}
                >
                  Defaults
                </Button>
                {MOCK_AGENTS.map((agent) => (
                  <Button
                    key={agent.id}
                    size="sm"
                    variant={selectedScope === agent.id ? "default" : "outline"}
                    onClick={() => setSelectedScope(agent.id)}
                  >
                    {agent.name || agent.id}
                  </Button>
                ))}
              </div>
            </div>

            {/* Policy Settings */}
            <div className="space-y-4">
              {/* Security Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-border/50">
                <div className="space-y-1">
                  <h4 className="font-medium">Security</h4>
                  <p className="text-sm text-muted-foreground">
                    {isDefaults ? "Default security mode." : `Default: ${security}`}
                  </p>
                </div>
                <Select value={security} onValueChange={(v: ExecSecurity) => setSecurity(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ask Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-border/50">
                <div className="space-y-1">
                  <h4 className="font-medium">Ask</h4>
                  <p className="text-sm text-muted-foreground">
                    {isDefaults ? "Default prompt policy." : `Default: ${ask}`}
                  </p>
                </div>
                <Select value={ask} onValueChange={(v: ExecAsk) => setAsk(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASK_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ask Fallback */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-border/50">
                <div className="space-y-1">
                  <h4 className="font-medium">Ask Fallback</h4>
                  <p className="text-sm text-muted-foreground">
                    {isDefaults
                      ? "Applied when the UI prompt is unavailable."
                      : `Default: ${askFallback}`}
                  </p>
                </div>
                <Select
                  value={askFallback}
                  onValueChange={(v: ExecSecurity) => setAskFallback(v)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-allow Skill CLIs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3">
                <div className="space-y-1">
                  <h4 className="font-medium">Auto-allow Skill CLIs</h4>
                  <p className="text-sm text-muted-foreground">
                    {isDefaults
                      ? "Allow skill executables listed by the Gateway."
                      : `Using default (${autoAllowSkills ? "on" : "off"}).`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={autoAllowSkills}
                    onCheckedChange={setAutoAllowSkills}
                  />
                  {!isDefaults && (
                    <Button size="sm" variant="ghost">
                      Use default
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Allowlist */}
            {!isDefaults && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Allowlist</h4>
                    <p className="text-sm text-muted-foreground">
                      Case-insensitive glob patterns.
                    </p>
                  </div>
                  <Button size="sm" onClick={handleAddPattern}>
                    <Icons.plus className="h-4 w-4" />
                    Add pattern
                  </Button>
                </div>

                <div className="space-y-3">
                  {allowlist.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No allowlist entries yet.
                    </div>
                  ) : (
                    allowlist.map((entry, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="font-medium">
                              {entry.pattern?.trim() || "New pattern"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Last used: {formatAgo(entry.lastUsedAt)}
                            </div>
                            {entry.lastUsedCommand && (
                              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                                {entry.lastUsedCommand}
                              </code>
                            )}
                            {entry.lastResolvedPath && (
                              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                                {entry.lastResolvedPath}
                              </code>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              value={entry.pattern}
                              onChange={(e) => handleUpdatePattern(index, e.target.value)}
                              placeholder="Pattern (e.g., git*)"
                              className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-40"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemovePattern(index)}
                            >
                              <Icons.trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-border/50">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Icons.loader className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
