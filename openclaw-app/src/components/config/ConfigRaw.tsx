/**
 * ConfigRaw component - Raw JSON5 textarea editor
 * Ported from ui/src/ui/views/config.ts raw mode
 */

"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConfigRawProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export function ConfigRaw({ value, onChange, disabled, error }: ConfigRawProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="config-raw" className="text-sm font-medium">
        Raw JSON5
      </Label>
      <Textarea
        id="config-raw"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter JSON5 config..."
        className="font-mono text-sm min-h-[400px] resize-y"
      />
      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Edit the raw JSON5 configuration directly. Use proper JSON5 syntax (unquoted keys, trailing commas allowed).
      </p>
    </div>
  );
}
