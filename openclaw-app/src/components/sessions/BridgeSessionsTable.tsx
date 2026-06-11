/**
 * BridgeSessionsTable - Sortable list of bridge sessions with row actions.
 */

"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { formatAgo } from "@/lib/utils-format";
import type { BridgeSessionInfo } from "@/types";

type SortKey = "updatedAt" | "key" | "lastChannel" | "lastTo";

interface BridgeSessionsTableProps {
  sessions: BridgeSessionInfo[];
  loading: boolean;
  onView: (key: string) => void;
  onReset: (key: string) => void;
  onDelete: (key: string) => void;
}

export function BridgeSessionsTable({
  sessions,
  loading,
  onView,
  onReset,
  onDelete,
}: BridgeSessionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "updatedAt":
          cmp = a.updatedAt - b.updatedAt;
          break;
        case "key":
          cmp = a.key.localeCompare(b.key);
          break;
        case "lastChannel":
          cmp = (a.lastChannel ?? "").localeCompare(b.lastChannel ?? "");
          break;
        case "lastTo":
          cmp = (a.lastTo ?? "").localeCompare(b.lastTo ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [sessions, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? (
      <Icons.arrowDown className="inline h-3 w-3 -mt-0.5 ml-1 rotate-180" />
    ) : (
      <Icons.arrowDown className="inline h-3 w-3 -mt-0.5 ml-1" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Icons.loaderSpin className="h-5 w-5 mr-2" />
        Loading bridge sessions...
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <div className="text-center">
          <Icons.messageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No bridge sessions yet.</p>
          <p className="text-xs mt-1">
            Sessions appear here as soon as a message is routed through the
            bridge.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort("key")}
              className="inline-flex items-center hover:text-foreground"
            >
              Key
              {sortIcon("key")}
            </button>
          </TableHead>
          <TableHead>Session ID</TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort("updatedAt")}
              className="inline-flex items-center hover:text-foreground"
            >
              Updated
              {sortIcon("updatedAt")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort("lastChannel")}
              className="inline-flex items-center hover:text-foreground"
            >
              Channel
              {sortIcon("lastChannel")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort("lastTo")}
              className="inline-flex items-center hover:text-foreground"
            >
              To
              {sortIcon("lastTo")}
            </button>
          </TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((s) => (
          <TableRow key={s.key}>
            <TableCell className="max-w-[260px]">
              <span className="font-mono text-xs truncate block" title={s.key}>
                {s.key}
              </span>
            </TableCell>
            <TableCell className="max-w-[200px]">
              <span
                className="font-mono text-xs text-muted-foreground truncate block"
                title={s.sessionId}
              >
                {s.sessionId.slice(0, 12)}…
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {formatAgo(s.updatedAt)}
            </TableCell>
            <TableCell>
              {s.lastChannel ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                  {s.lastChannel}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-[180px]">
              <span
                className="font-mono text-xs text-muted-foreground truncate block"
                title={s.lastTo}
              >
                {s.lastTo ?? "—"}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <div className="inline-flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(s.key)}
                  title="View details"
                >
                  <Icons.search className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReset(s.key)}
                  title="Reset session (mint new sessionId)"
                >
                  <Icons.refreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(s.key)}
                  title="Delete session from bridge store"
                  className="text-destructive hover:text-destructive"
                >
                  <Icons.trash className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
