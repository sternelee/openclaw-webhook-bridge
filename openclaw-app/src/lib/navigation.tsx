/**
 * Navigation configuration for the OpenClaw web app.
 * Ported from /Users/sternelee/www/github/openclaw/ui/src/ui/navigation.ts
 */

import { Icons } from "@/components/ui/icons";
import type { IconName } from "@/components/ui/icons";

export const TAB_GROUPS = [
  { label: "Chat", tabs: ["chat"] },
  { label: "Sessions", tabs: ["sessions"] },
  { label: "Settings", tabs: ["settings"] },
] as const;

export type Tab = "chat" | "sessions" | "settings";

const TAB_PATHS: Record<Tab, string> = {
  chat: "/chat",
  sessions: "/sessions",
  settings: "/settings",
};

const PATH_TO_TAB = new Map(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]),
);

export function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab): string {
  return TAB_PATHS[tab];
}

export function tabFromPath(pathname: string): Tab | null {
  let path = pathname || "/";
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) {
    normalized = "/";
  }
  if (normalized === "/") {
    return "chat";
  }
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "chat":
      return "messageSquare";
    case "sessions":
      return "database";
    case "settings":
      return "settings";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab) {
  switch (tab) {
    case "chat":
      return "Chat";
    case "sessions":
      return "Bridge Sessions";
    case "settings":
      return "Settings";
    default:
      return "";
  }
}

export function subtitleForTab(tab: Tab) {
  switch (tab) {
    case "chat":
      return "Direct gateway chat session for quick interventions.";
    case "sessions":
      return "Inspect, reset, or delete sessions tracked by the Rust Bridge.";
    case "settings":
      return "Edit ~/.openclaw/openclaw.json safely.";
    default:
      return "";
  }
}

// Icon component helper
export function TabIcon({ tab, className }: { tab: Tab; className?: string }) {
  const iconName = iconForTab(tab);
  const IconComponent = Icons[iconName];
  return <IconComponent className={className} />;
}
