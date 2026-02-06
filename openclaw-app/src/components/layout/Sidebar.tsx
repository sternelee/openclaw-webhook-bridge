/**
 * Sidebar navigation component.
 * Ported from /Users/sternelee/www/github/openclaw/ui/src/ui/navigation.ts
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/ui/icons";
import { TAB_GROUPS, iconForTab, titleForTab } from "@/lib/navigation";
import { useAppStore } from "@/store/use-app-store";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const currentTab = pathname.split("/")?.[1] || "chat";
  const { connected, focusMode } = useAppStore();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  // Don't render in focus mode
  if (focusMode) return null;

  return (
    <aside className={cn("flex flex-col border-r border-border/50 bg-card/30 w-56", className)}>
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Icons.brain className="h-5 w-5 text-accent" />
        <span className="font-semibold">OpenClaw</span>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-4">
          {TAB_GROUPS.map((group) => {
            const isCollapsed = collapsedGroups[group.label];

            return (
              <div key={group.label}>
                <Button
                  variant="ghost"
                  className="w-full justify-start px-2 py-1 h-7 text-xs font-medium text-muted-foreground hover:text-foreground mb-1"
                  onClick={() => toggleGroup(group.label)}
                >
                  <Icons.chevronRight
                    className={cn(
                      "h-3 w-3 mr-1 transition-transform",
                      !isCollapsed && "rotate-90"
                    )}
                  />
                  {group.label}
                </Button>

                {!isCollapsed && (
                  <div className="space-y-0.5 pl-1">
                    {group.tabs.map((tab) => {
                      const TabIcon = Icons[iconForTab(tab)];
                      const isActive = currentTab === tab;
                      const href = `/${tab}`;

                      return (
                        <Link key={tab} href={href}>
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn(
                              "w-full justify-start gap-2 h-8 text-sm",
                              isActive && "bg-accent/10 text-accent"
                            )}
                          >
                            <TabIcon className="h-4 w-4" />
                            <span>{titleForTab(tab)}</span>
                          </Button>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border/50">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
          <span className={cn("w-2 h-2 rounded-full", connected ? "bg-ok animate-pulse" : "bg-muted")} />
          <span className="text-xs text-muted-foreground">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
    </aside>
  );
}
