/**
 * Usage page - Token usage, costs, and activity analytics.
 * Ported from /Users/sternelee/www/github/openclaw/ui/src/ui/views/usage.ts
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Icons } from "@/components/ui/icons";
import { formatDistanceToNow } from "date-fns";

// Helper to format tokens
function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

// Helper to format cost
function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

// Type definition for usage data
interface UsageData {
  totalTokens: number;
  totalCost: number;
  sessions: number;
  messages: number;
}

export default function UsagePage() {
  const router = useRouter();
  const { connected } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Last 7 days by default
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    if (!connected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Placeholder for actual API call
      // In a real implementation, this would call the gateway API
      // const result = await client.request("sessions.usage", { startDate, endDate });
      
      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setUsageData({
        totalTokens: 125000,
        totalCost: 2.45,
        sessions: 15,
        messages: 47,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    if (connected) {
      loadUsage();
    }
  }, [connected, loadUsage]);

  const handleRefresh = () => {
    loadUsage();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold">Usage</h1>
          <p className="text-sm text-muted-foreground">
            Token usage, costs, and activity analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={!connected || loading}>
            <Icons.refreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-6">
            {!connected && (
              <Card className="mb-6">
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Icons.wifiOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Not Connected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect to the gateway to view usage data.
                    </p>
                    <Button variant="default" onClick={() => router.push("/config")}>
                      Go to Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="mb-6 border-danger/50 bg-danger/5">
                <CardContent className="p-4">
                  <p className="text-sm text-danger">{error}</p>
                </CardContent>
              </Card>
            )}

            {connected && (
              <>
                {/* Date Range Selector */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-base">Date Range</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="start-date" className="text-sm mb-1">
                          Start Date
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date" className="text-sm mb-1">
                          End Date
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={loadUsage} disabled={loading} className="w-full">
                          Load Data
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats */}
                {usageData && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Tokens
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-semibold">
                            {formatTokens(usageData.totalTokens)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Cost
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-semibold">
                            {formatCost(usageData.totalCost)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Sessions
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-semibold">{usageData.sessions}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Messages
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-semibold">{usageData.messages}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Coming Soon */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Detailed Analytics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Icons.barChart className="h-16 w-16 mb-4 text-muted-foreground" />
                          <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
                          <p className="text-sm text-muted-foreground max-w-md">
                            Detailed usage analytics, session breakdowns, model comparisons,
                            and cost optimization insights will be available here.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {!usageData && !loading && (
                  <Card>
                    <CardContent className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Icons.barChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">No Data</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Select a date range and click "Load Data" to view usage statistics.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
