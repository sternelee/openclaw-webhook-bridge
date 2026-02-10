/**
 * Nodes page - Paired devices, capabilities, and command exposure.
 */

"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ExecApprovals, NodeBindings, DevicesList, NodesList } from "@/components/nodes";

export default function NodesPage() {
  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border/50 bg-card/50">
          <div>
            <h1 className="text-xl font-semibold">Nodes</h1>
            <p className="text-sm text-muted-foreground">
              Paired devices, capabilities, and command exposure.
            </p>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            {/* Exec Approvals Section */}
            <ExecApprovals />

            {/* Node Bindings Section */}
            <NodeBindings />

            {/* Devices Section */}
            <DevicesList />

            {/* Nodes List Section */}
            <NodesList />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
