/**
 * MobileNavigation component - Sheet-based navigation for mobile devices.
 * Provides a slide-in menu for mobile users.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Icons } from "@/components/ui/icons";
import { TAB_GROUPS, iconForTab, titleForTab } from "@/lib/navigation";
import { useAppStore } from "@/store/use-app-store";

export function MobileNavigation() {
  const pathname = usePathname();
  const currentTab = pathname.split("/")?.[1] || "chat";
  const { connected, focusMode } = useAppStore();
  const [open, setOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    "Navigation": false,
    "Settings": true,
  });

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  // Don't render in focus mode
  if (focusMode) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden touch-target"
          aria-label="Open navigation"
        >
          <Icons.menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[280px] p-0 safe-area-top"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Icons.brain className="h-5 w-5 text-accent" />
              <SheetTitle>OpenClaw</SheetTitle>
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="touch-target">
                <Icons.x className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-4">
            {TAB_GROUPS.map((group) => {
              const isCollapsed = collapsedGroups[group.label];

              return (
                <div key={group.label}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-3 py-2 h-9 text-sm font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => toggleGroup(group.label)}
                  >
                    <Icons.chevronRight
                      className={cn(
                        "h-4 w-4 mr-2 transition-transform",
                        !isCollapsed && "rotate-90"
                      )}
                    />
                    {group.label}
                  </Button>

                  {!isCollapsed && (
                    <div className="space-y-1 pl-2">
                      {group.tabs.map((tab) => {
                        const TabIcon = Icons[iconForTab(tab)];
                        const isActive = currentTab === tab;
                        const href = `/${tab}`;

                        return (
                          <SheetClose key={tab} asChild>
                            <Link href={href}>
                              <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                  "w-full justify-start gap-3 h-11 text-sm touch-target",
                                  isActive && "bg-accent/10 text-accent"
                                )}
                              >
                                <TabIcon className="h-5 w-5" />
                                <span>{titleForTab(tab)}</span>
                              </Button>
                            </Link>
                          </SheetClose>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer with connection status */}
        <div className="p-4 border-t border-border/50 safe-area-bottom">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30">
            <span className={cn("w-2.5 h-2.5 rounded-full", connected ? "bg-ok animate-pulse" : "bg-muted")} />
            <span className="text-sm text-muted-foreground">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
