/**
 * Agents page - Manage agent workspaces, tools, and identities.
 */

"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";

export default function AgentsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50">
        <div>
          <h1 className="text-xl font-semibold">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage agent workspaces, tools, and identities.
          </p>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <Icons.folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Agent management will be available soon.
            </p>
            <Button variant="outline" onClick={() => router.push("/chat")}>
              Back to Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
