/**
 * WhatsApp channel card with QR code support.
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ChannelConfig } from "./ChannelConfig";
import type { WhatsAppStatus } from "./types";

interface WhatsAppCardProps {
  status: WhatsAppStatus;
}

export function WhatsAppCard({ status }: WhatsAppCardProps) {
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShowQr = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    setQrModalOpen(true);
  };

  const handleRelink = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
  };

  const handleWait = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setLoading(false);
  };

  const statusItems = [
    { label: "Configured", value: status.configured },
    { label: "Linked", value: status.linked },
    { label: "Running", value: status.running },
    { label: "Connected", value: status.connected },
  ];

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/15">
                <Icons.whatsapp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Meta WhatsApp integration
                </p>
              </div>
            </div>
            {status.connected && status.running ? (
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                Connected
              </Badge>
            ) : status.linked ? (
              <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                Linking...
              </Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status indicators */}
          <div className="flex flex-wrap gap-2">
            {statusItems.map((item) => (
              <Badge
                key={item.label}
                variant={item.value ? "default" : "secondary"}
                className="text-xs"
              >
                {item.label}
              </Badge>
            ))}
          </div>

          {/* Timestamps */}
          <div className="space-y-1 text-xs text-muted-foreground">
            {status.lastConnect && (
              <p>Last connect: {status.lastConnect}</p>
            )}
            {status.lastMessage && (
              <p>Last message: {status.lastMessage}</p>
            )}
            {status.authAge && (
              <p>Auth age: {status.authAge}</p>
            )}
          </div>

          {/* Error message */}
          {status.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-start gap-2">
              <Icons.alertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{status.error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleShowQr}
              disabled={loading || status.connected}
            >
              {loading ? (
                <Icons.loaderSpin className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Icons.qrCode className="h-4 w-4 mr-2" />
              )}
              Show QR
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRelink}
              disabled={loading}
            >
              <Icons.refreshCw className="h-4 w-4 mr-2" />
              Relink
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleWait}
              disabled={loading || !status.linked}
            >
              <Icons.clock className="h-4 w-4 mr-2" />
              Wait for Scan
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleLogout}
              disabled={loading || !status.linked}
              className="text-destructive hover:text-destructive"
            >
              <Icons.logOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Channel config */}
          <ChannelConfig
            channelName="whatsapp"
            configured={status.configured}
            running={status.running}
          />
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link WhatsApp</DialogTitle>
            <DialogDescription>
              Scan this QR code with WhatsApp to link your account
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-lg bg-white p-4">
              {/* Placeholder QR code - in production this would be the actual QR code */}
              <div className="h-48 w-48 bg-gray-100 rounded flex items-center justify-center">
                <Icons.qrCode className="h-32 w-32 text-gray-400" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              1. Open WhatsApp on your phone
              <br />
              2. Tap Settings → Linked Devices
              <br />
              3. Tap "Link a Device"
              <br />
              4. Scan the QR code above
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
