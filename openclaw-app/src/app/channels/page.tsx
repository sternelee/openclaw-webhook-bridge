/**
 * Channels page - Manage channels and settings.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ChannelCard } from "@/components/channels/ChannelCard";
import { AccountCard } from "@/components/channels/AccountCard";
import { WhatsAppCard } from "@/components/channels/WhatsAppCard";
import { NostrCard } from "@/components/channels/NostrCard";
import type { ChannelAccount, WhatsAppStatus, NostrStatus } from "@/components/channels/types";

export default function ChannelsPage() {
  // Mock WhatsApp status
  const whatsappStatus: WhatsAppStatus = {
    configured: true,
    linked: true,
    running: true,
    connected: true,
    lastConnect: "2 minutes ago",
    lastMessage: "5 minutes ago",
    authAge: "24 days",
  };

  // Mock Nostr status
  const nostrStatus: NostrStatus = {
    publicKey: "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
    profile: {
      name: "OpenClaw User",
      displayName: "OpenClaw",
      about: "AI assistant agent",
      nip05: "openclaw@nostr.com",
    },
    lastStart: "1 hour ago",
  };

  // Mock Telegram accounts
  const telegramAccounts: ChannelAccount[] = [
    {
      name: "Main Bot",
      accountId: "openclaw_bot",
      status: "ok",
      lastInbound: "2 minutes ago",
    },
    {
      name: "Test Bot",
      accountId: "openclaw_test_bot",
      status: "warn",
      lastInbound: "1 day ago",
      lastError: "Rate limit exceeded",
    },
  ];

  // Mock Discord accounts
  const discordAccounts: ChannelAccount[] = [
    {
      name: "Production",
      accountId: "123456789012345678",
      status: "ok",
      lastInbound: "5 minutes ago",
    },
  ];

  // Mock Google Chat accounts
  const googleChatAccounts: ChannelAccount[] = [
    {
      name: "Workspace",
      accountId: "openclaw@workspace.com",
      status: "ok",
      lastInbound: "10 minutes ago",
    },
  ];

  // Mock Slack accounts
  const slackAccounts: ChannelAccount[] = [
    {
      name: "General Team",
      accountId: "T0123456789",
      status: "ok",
      lastInbound: "3 minutes ago",
    },
    {
      name: "Support Team",
      accountId: "T0987654321",
      status: "unknown",
    },
  ];

  // Mock Signal accounts
  const signalAccounts: ChannelAccount[] = [
    {
      name: "Primary",
      accountId: "+1234567890",
      status: "danger",
      lastError: "Connection timeout",
    },
  ];

  // Mock iMessage accounts
  const imessageAccounts: ChannelAccount[] = [
    {
      name: "Apple ID",
      accountId: "user@icloud.com",
      status: "ok",
      lastInbound: "1 hour ago",
    },
  ];

  // Mock channel health data
  const channelHealth = {
    lastSuccess: "2 minutes ago",
    channels: {
      whatsapp: { status: "ok", lastMessage: "5 minutes ago" },
      telegram: { status: "ok", lastMessage: "2 minutes ago" },
      discord: { status: "ok", lastMessage: "5 minutes ago" },
      nostr: { status: "ok", lastMessage: "30 minutes ago" },
      googleChat: { status: "ok", lastMessage: "10 minutes ago" },
      slack: { status: "ok", lastMessage: "3 minutes ago" },
      signal: { status: "error", lastError: "Connection timeout" },
      imessage: { status: "ok", lastMessage: "1 hour ago" },
    },
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Channels</h1>
          <p className="text-sm text-muted-foreground">Manage channels and settings.</p>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* 2-column grid for channel cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp Card */}
            <WhatsAppCard status={whatsappStatus} />

            {/* Nostr Card */}
            <NostrCard status={nostrStatus} />

            {/* Telegram Card */}
            <ChannelCard
              name="Telegram"
              icon="telegram"
              description="Telegram Bot API"
              accountCount={telegramAccounts.length}
            >
              <div className="space-y-2">
                {telegramAccounts.map((account) => (
                  <AccountCard key={account.accountId} {...account} />
                ))}
              </div>
            </ChannelCard>

            {/* Discord Card */}
            <ChannelCard
              name="Discord"
              icon="discord"
              description="Discord Bot"
              accountCount={discordAccounts.length}
            >
              <div className="space-y-2">
                {discordAccounts.map((account) => (
                  <AccountCard key={account.accountId} {...account} />
                ))}
              </div>
            </ChannelCard>

            {/* Google Chat Card */}
            <ChannelCard
              name="Google Chat"
              icon="googleChat"
              description="Google Chat integration"
              accountCount={googleChatAccounts.length}
            >
              <div className="space-y-2">
                {googleChatAccounts.map((account) => (
                  <AccountCard key={account.accountId} {...account} />
                ))}
              </div>
            </ChannelCard>

            {/* Slack Card */}
            <ChannelCard
              name="Slack"
              icon="slack"
              description="Slack App"
              accountCount={slackAccounts.length}
            >
              <div className="space-y-2">
                {slackAccounts.map((account) => (
                  <AccountCard key={account.accountId} {...account} />
                ))}
              </div>
            </ChannelCard>

            {/* Signal Card */}
            <ChannelCard
              name="Signal"
              icon="signal"
              description="Signal messaging"
              status={signalAccounts[0]?.status}
              accountCount={signalAccounts.length}
            >
              <div className="space-y-2">
                {signalAccounts.map((account) => (
                  <AccountCard key={account.accountId} {...account} />
                ))}
              </div>
            </ChannelCard>

            {/* iMessage Card */}
            <ChannelCard
              name="iMessage"
              icon="imessage"
              description="Apple iMessage"
              accountCount={imessageAccounts.length}
            >
              <div className="space-y-2">
                {imessageAccounts.map((account) => (
                  <AccountCard key={account.accountId} {...account} />
                ))}
              </div>
            </ChannelCard>
          </div>

          {/* Channel Health Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.health className="h-5 w-5" />
                Channel Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Icons.activity className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  Last successful connection: {channelHealth.lastSuccess}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Channel Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(channelHealth.channels).map(([channel, data]) => (
                    <Badge
                      key={channel}
                      variant={("status" in data && data.status === "error") ? "destructive" : "default"}
                      className={cn(
                        "capitalize",
                        ("status" in data && data.status === "ok") && "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
                      )}
                    >
                      {channel}: {"status" in data ? data.status : "ok"}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Full Status</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                  {JSON.stringify(channelHealth, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
