/**
 * Nostr profile editing form component.
 */

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/ui/icons";
import type { NostrProfile } from "./types";

interface NostrProfileFormProps {
  initialProfile?: NostrProfile;
  onSave: (profile: NostrProfile) => void | Promise<void>;
  onCancel: () => void;
  onImport?: () => void | Promise<void>;
}

export function NostrProfileForm({
  initialProfile = {},
  onSave,
  onCancel,
  onImport,
}: NostrProfileFormProps) {
  const [profile, setProfile] = useState<NostrProfile>(initialProfile);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    field: keyof NostrProfile,
    value: string
  ) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    await onSave(profile);
    setLoading(false);
  };

  const handleImport = async () => {
    setLoading(true);
    await onImport?.();
    setLoading(false);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={profile.name || ""}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Your display name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={profile.displayName || ""}
            onChange={(e) => handleChange("displayName", e.target.value)}
            placeholder="Your display name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="about">About</Label>
          <Textarea
            id="about"
            value={profile.about || ""}
            onChange={(e) => handleChange("about", e.target.value)}
            placeholder="Tell us about yourself"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="picture">Picture URL</Label>
          <Input
            id="picture"
            value={profile.picture || ""}
            onChange={(e) => handleChange("picture", e.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nip05">NIP-05</Label>
          <Input
            id="nip05"
            value={profile.nip05 || ""}
            onChange={(e) => handleChange("nip05", e.target.value)}
            placeholder="username@domain.com"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading ? (
              <Icons.loaderSpin className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Icons.check className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            <Icons.x className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          {onImport && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleImport}
              disabled={loading}
            >
              <Icons.download className="h-4 w-4 mr-2" />
              Import
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
