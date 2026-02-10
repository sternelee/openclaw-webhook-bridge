/**
 * Config page - Enhanced configuration page with sidebar navigation.
 * Ported from openclaw/ui reference implementation.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MobileNavigation, MobileHeader } from "@/components/layout";
import {
  ConfigSidebar,
  ConfigForm,
  ConfigRaw,
  ConfigDiff,
} from "@/components/config";
import type { JsonSchema } from "@/components/config/config-utils";

// Mock config schema for development - would be loaded from gateway
const MOCK_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    env: {
      type: "object",
      title: "Environment",
      description: "Environment variables and system configuration",
      properties: {
        logLevel: {
          type: "string",
          title: "Log Level",
          description: "Set the logging verbosity",
          enum: ["debug", "info", "warn", "error"],
          default: "info",
        },
        port: {
          type: "integer",
          title: "Gateway Port",
          description: "Port for the gateway server",
          default: 18789,
        },
      },
    },
    agents: {
      type: "object",
      title: "Agents",
      description: "Agent configuration and behavior",
      properties: {
        defaultAgent: {
          type: "string",
          title: "Default Agent",
          description: "The default agent to use for conversations",
          default: "main",
        },
        agentTimeout: {
          type: "integer",
          title: "Agent Timeout",
          description: "Timeout in seconds for agent responses",
          default: 120,
        },
      },
    },
    messages: {
      type: "object",
      title: "Messages",
      description: "Message handling and processing",
      properties: {
        maxHistoryLength: {
          type: "integer",
          title: "Max History Length",
          description: "Maximum number of messages to keep in history",
          default: 100,
        },
        enableStreaming: {
          type: "boolean",
          title: "Enable Streaming",
          description: "Enable streaming response generation",
          default: true,
        },
      },
    },
  },
};

export default function ConfigPage() {
  const { connected } = useAppStore();

  // Config state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"form" | "raw">("form");
  const [schema] = useState<JsonSchema | null>(MOCK_SCHEMA);
  const [schemaLoading] = useState(false);

  // Config values
  const [formValue, setFormValue] = useState<Record<string, unknown> | null>({
    env: {
      logLevel: "info",
      port: 18789,
    },
    agents: {
      defaultAgent: "main",
      agentTimeout: 120,
    },
    messages: {
      maxHistoryLength: 100,
      enableStreaming: true,
    },
  });
  const [originalValue, setOriginalValue] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [rawConfig, setRawConfig] = useState("");
  const [originalRaw, setOriginalRaw] = useState("");

  // Loading and validation states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [issues, setIssues] = useState<unknown[]>([]);

  // Initialize raw config when form value changes
  useEffect(() => {
    if (formValue && formMode === "raw") {
      setRawConfig(JSON.stringify(formValue, null, 2));
      setOriginalRaw(JSON.stringify(formValue, null, 2));
    }
  }, [formValue, formMode]);

  // Handle form patch
  const handleFormPatch = useCallback(
    (path: Array<string | number>, value: unknown) => {
      setFormValue((prev) => {
        if (!prev) return prev;

        const newConfig = { ...prev };
        let current: Record<string, unknown> = newConfig;

        for (let i = 0; i < path.length - 1; i++) {
          const key = path[i];
          if (typeof key === "string") {
            if (!current[key]) {
              current[key] = {};
            }
            current = current[key] as Record<string, unknown>;
          }
        }

        const lastKey = path[path.length - 1];
        if (typeof lastKey === "string") {
          current[lastKey] = value;
        }

        return newConfig;
      });
    },
    [],
  );

  // Handle reload
  const handleReload = async () => {
    setLoading(true);
    try {
      // Would load from gateway in production
      await new Promise((resolve) => setTimeout(resolve, 500));
      setValid(true);
      setIssues([]);
    } catch (error) {
      console.error("Failed to load config:", error);
      setValid(false);
      setIssues([error]);
    } finally {
      setLoading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      // Would save to disk in production
      await new Promise((resolve) => setTimeout(resolve, 500));
      setOriginalValue(formValue);
      setOriginalRaw(rawConfig);
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle apply
  const handleApply = async () => {
    setApplying(true);
    try {
      // Would apply to gateway in production
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Failed to apply config:", error);
    } finally {
      setApplying(false);
    }
  };

  // Compute changes
  const hasChanges =
    formMode === "form"
      ? JSON.stringify(formValue) !== JSON.stringify(originalValue)
      : rawConfig !== originalRaw;

  // Available sections from schema
  const availableSections = schema?.properties
    ? Object.keys(schema.properties)
    : [];

  // Header content for mobile
  const headerContent = (
    <>
      <h1 className="text-base md:text-lg font-semibold truncate">
        Configuration
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
          {/* Connection status indicator only - no connect/disconnect for config page */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              connected
                ? "bg-ok/10 text-ok"
                : "bg-muted/50 text-muted-foreground"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-ok animate-pulse" : ""}`}
            />
            {connected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <ConfigSidebar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            formMode={formMode}
            onFormModeChange={setFormMode}
            validity={valid == null ? "unknown" : valid ? "valid" : "invalid"}
            schemaLoading={schemaLoading}
            availableSections={availableSections}
          />
        </div>

        {/* Main Config Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Action Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50">
            <div className="flex items-center gap-2">
              {hasChanges ? (
                <span className="text-sm text-accent">Unsaved changes</span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No changes
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={handleReload}
              >
                {loading ? "Loading..." : "Reload"}
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!hasChanges || saving}
                onClick={handleSave}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasChanges || applying}
                onClick={handleApply}
              >
                {applying ? "Applying..." : "Apply"}
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
              {/* Diff Viewer (form mode only) */}
              {formMode === "form" && originalValue && formValue && (
                <ConfigDiff original={originalValue} current={formValue} />
              )}

              {/* Form or Raw Editor */}
              {formMode === "form" ? (
                <ConfigForm
                  schema={schema}
                  value={formValue}
                  disabled={loading || saving || applying}
                  activeSection={activeSection}
                  onPatch={handleFormPatch}
                  uiHints={{}}
                />
              ) : (
                <ConfigRaw
                  value={rawConfig}
                  onChange={setRawConfig}
                  disabled={loading || saving || applying}
                />
              )}

              {/* Issues Display */}
              {issues.length > 0 && (
                <div className="p-4 bg-danger/10 border border-danger/50 rounded-lg">
                  <h3 className="text-sm font-medium text-danger mb-2">
                    Configuration Issues
                  </h3>
                  <pre className="text-xs text-muted-foreground overflow-auto">
                    {JSON.stringify(issues, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <div className="flex items-center justify-around px-4 py-3 border-t border-border/50 bg-card/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFormMode("form")}
            className={formMode === "form" ? "bg-accent/10" : ""}
          >
            Form
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFormMode("raw")}
            className={formMode === "raw" ? "bg-accent/10" : ""}
          >
            Raw
          </Button>
        </div>
      </div>
    </div>
  );
}
