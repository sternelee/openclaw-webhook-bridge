/**
 * Nostr channel card with profile editing support.
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { ChannelConfig } from "./ChannelConfig";
import { NostrProfileForm } from "./NostrProfileForm";
import type { NostrStatus, NostrProfile } from "./types";

interface NostrCardProps {
  status: NostrStatus;
}

export function NostrCard({ status }: NostrCardProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async (profile: NostrProfile) => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    setEditing(false);
  };

  const handleImportProfile = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
  };

  const truncatePublicKey = (key?: string) => {
    if (!key) return "Not available";
    if (key.length <= 16) return key;
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15">
              <Icons.nostr className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">Nostr</CardTitle>
              <p className="text-sm text-muted-foreground">
                Decentralized social protocol
              </p>
            </div>
          </div>
          {status.publicKey && (
            <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Public key */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Public Key</p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
              {truncatePublicKey(status.publicKey)}
            </code>
            {status.publicKey && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => navigator.clipboard.writeText(status.publicKey!)}
              >
                <Icons.copy className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Profile section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Profile</p>
            {!editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <Icons.edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>

          {editing ? (
            <NostrProfileForm
              initialProfile={status.profile}
              onSave={handleSaveProfile}
              onCancel={() => setEditing(false)}
              onImport={handleImportProfile}
            />
          ) : (
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-2">
                {status.profile?.name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm">{status.profile.name}</p>
                  </div>
                )}
                {status.profile?.displayName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Display Name</p>
                    <p className="text-sm">{status.profile.displayName}</p>
                  </div>
                )}
                {status.profile?.about && (
                  <div>
                    <p className="text-xs text-muted-foreground">About</p>
                    <p className="text-sm">{status.profile.about}</p>
                  </div>
                )}
                {status.profile?.nip05 && (
                  <div>
                    <p className="text-xs text-muted-foreground">NIP-05</p>
                    <p className="text-sm font-mono">{status.profile.nip05}</p>
                  </div>
                )}
                {!status.profile?.name &&
                  !status.profile?.displayName &&
                  !status.profile?.about && (
                    <p className="text-sm text-muted-foreground">
                      No profile information set
                    </p>
                  )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Last start timestamp */}
        {status.lastStart && (
          <div className="text-xs text-muted-foreground">
            Last started: {status.lastStart}
          </div>
        )}

        {/* Channel config */}
        <ChannelConfig channelName="nostr" configured={!!status.publicKey} />
      </CardContent>
    </Card>
  );
}
