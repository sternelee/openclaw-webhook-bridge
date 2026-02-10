/**
 * Channel configuration section component.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";

interface ChannelConfigProps {
  channelName: string;
  configured: boolean;
  running?: boolean;
  children?: React.ReactNode;
}

export function ChannelConfig({
  channelName,
  configured,
  running,
  children,
}: ChannelConfigProps) {
  return (
    <Card className="bg-muted/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icons.settings className="h-4 w-4" />
          Channel Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={configured ? "default" : "secondary"} className="text-xs">
            {configured ? "Configured" : "Not Configured"}
          </Badge>
          {running !== undefined && (
            <Badge variant={running ? "default" : "secondary"} className="text-xs">
              {running ? "Running" : "Stopped"}
            </Badge>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
