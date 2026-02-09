/**
 * AppShell component - Main layout wrapper with sidebar and content area.
 */

"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/store/use-app-store";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { focusMode } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - hidden on mobile and in focus mode */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
