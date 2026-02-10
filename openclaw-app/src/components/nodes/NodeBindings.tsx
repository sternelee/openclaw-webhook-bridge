/**
 * NodeBindings section - Pin agents to specific nodes for exec commands.
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
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AgentBinding {
  id: string;
  name?: string;
  index: number;
  isDefault: boolean;
  binding?: string | null;
}

interface NodeOption {
  id: string;
  label: string;
}

// Mock data for demonstration
const MOCK_NODES: NodeOption[] = [
  { id: "", label: "Any node" },
  { id: "node-1", label: "MacBook Pro" },
  { id: "node-2", label: "Development Server" },
  { id: "node-3", label: "Production Server" },
];

const MOCK_AGENTS: AgentBinding[] = [
  { id: "main", name: "Main", index: 0, isDefault: true, binding: null },
  { id: "coder", name: "Coder", index: 1, isDefault: false, binding: "node-1" },
  { id: "analyst", name: "Analyst", index: 2, isDefault: false, binding: null },
];

export function NodeBindings() {
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultBinding, setDefaultBinding] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentBinding[]>(MOCK_AGENTS);
  const [nodes] = useState<NodeOption[]>(MOCK_NODES);

  const handleSave = () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      console.log("Saved node bindings:", {
        defaultBinding,
        agents,
      });
    }, 1000);
  };

  const handleBindDefault = (nodeId: string | null) => {
    setDefaultBinding(nodeId);
  };

  const handleBindAgent = (agentIndex: number, nodeId: string | null) => {
    const updated = [...agents];
    updated[agentIndex] = { ...updated[agentIndex], binding: nodeId };
    setAgents(updated);
  };

  const supportsBinding = nodes.length > 1; // More than just "Any node"

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Icons.link className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <CardTitle>Exec Node Binding</CardTitle>
                  <CardDescription>
                    Pin agents to a specific node when using{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">exec host=node</code>
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
          <CardContent className="space-y-4">
            {/* Default Binding */}
            <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Default Binding</h4>
                    {agents.some((a) => a.isDefault) && (
                      <Badge variant="secondary" className="text-xs">
                        {agents.find((a) => a.isDefault)?.name || "main"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Used when agents do not override a node binding.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={defaultBinding || ""}
                    onValueChange={(value) => handleBindDefault(value || null)}
                    disabled={!supportsBinding}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Any node" />
                    </SelectTrigger>
                    <SelectContent>
                      {nodes.map((node) => (
                        <SelectItem key={node.id} value={node.id}>
                          {node.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {!supportsBinding && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No nodes with <code className="bg-muted px-1 py-0.5 rounded">system.run</code> available.
              </div>
            )}

            {/* Agent-specific Bindings */}
            <div className="space-y-3">
              {agents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No agents found.
                </div>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-4 rounded-lg border border-border/50 bg-muted/20"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">
                            {agent.name ? `${agent.name} (${agent.id})` : agent.id}
                          </h4>
                          {agent.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              default agent
                            </Badge>
                          )}
                          {!agent.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              agent
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {agent.binding === "__default__" || agent.binding === null
                            ? `uses default (${defaultBinding || "any"})`
                            : `override: ${nodes.find((n) => n.id === agent.binding)?.label || agent.binding}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Select
                          value={agent.binding === null ? "__default__" : agent.binding}
                          onValueChange={(value) =>
                            handleBindAgent(
                              agent.index,
                              value === "__default__" ? null : value
                            )
                          }
                          disabled={!supportsBinding}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">Use default</SelectItem>
                            {nodes
                              .filter((n) => n.id !== "") // Filter out "Any node" from agent bindings
                              .map((node) => (
                                <SelectItem key={node.id} value={node.id}>
                                  {node.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-border/50">
              <Button onClick={handleSave} disabled={saving || !supportsBinding}>
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
