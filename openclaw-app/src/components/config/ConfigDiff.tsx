/**
 * ConfigDiff component - Shows pending changes
 * Ported from ui/src/ui/views/config.ts diff section
 */

"use client";

import { Icons } from "@/components/ui/icons";
import { computeDiff, truncateValue } from "./config-utils";

interface ConfigDiffProps {
  original: Record<string, unknown> | null;
  current: Record<string, unknown> | null;
  count?: number;
}

export function ConfigDiff({ original, current, count }: ConfigDiffProps) {
  const diff = computeDiff(original, current);
  const showCount = count ?? diff.length;

  if (showCount === 0) {
    return null;
  }

  return (
    <details className="group border border-border/50 rounded-lg bg-card/50 overflow-hidden">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-card/80 transition-colors select-none">
        <span className="text-sm font-medium">
          View {showCount} pending change{showCount !== 1 ? "s" : ""}
        </span>
        <Icons.chevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/50 max-h-64 overflow-y-auto">
        {diff.map((change, index) => (
          <div
            key={index}
            className="px-4 py-2 border-b border-border/30 last:border-b-0 hover:bg-card/50 transition-colors"
          >
            <div className="text-xs text-muted-foreground font-mono mb-1">{change.path}</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground line-through">
                {truncateValue(change.from)}
              </span>
              <Icons.arrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
              <span className="text-ok">{truncateValue(change.to)}</span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
