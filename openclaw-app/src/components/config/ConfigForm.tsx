/**
 * ConfigForm component - Dynamic form generation based on JSON schema
 * Ported from ui/src/ui/views/config-form.node.ts
 */

"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { JsonSchema } from "./config-utils";

interface ConfigFormProps {
  schema: JsonSchema | null;
  value: Record<string, unknown> | null;
  disabled: boolean;
  activeSection: string | null;
  onPatch: (path: Array<string | number>, value: unknown) => void;
  uiHints?: Record<string, { label?: string; help?: string; placeholder?: string; order?: number | string; sensitive?: boolean }>;
}

interface FieldProps {
  schema: JsonSchema;
  value: unknown;
  path: Array<string | number>;
  disabled: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
  hints: Record<string, { label?: string; help?: string; placeholder?: string; order?: number | string; sensitive?: boolean }>;
  showLabel?: boolean;
}

export function ConfigForm({
  schema,
  value,
  disabled,
  activeSection,
  onPatch,
  uiHints = {},
}: ConfigFormProps) {
  if (!schema) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Icons.fileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No schema available</h3>
          <p className="text-sm text-muted-foreground">
            Unable to load configuration schema.
          </p>
        </div>
      </div>
    );
  }

  // Filter based on active section
  if (activeSection && schema.properties) {
    const sectionSchema = schema.properties[activeSection];
    if (sectionSchema && typeof sectionSchema === "object" && sectionSchema.type === "object") {
      return (
        <div className="space-y-6">
          <Field
            schema={sectionSchema}
            value={(value?.[activeSection] as Record<string, unknown>) ?? null}
            path={[activeSection]}
            disabled={disabled}
            onPatch={onPatch}
            hints={uiHints}
          />
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <Field
        schema={schema}
        value={value ?? null}
        path={[]}
        disabled={disabled}
        onPatch={onPatch}
        hints={uiHints}
      />
    </div>
  );
}

function getSchemaType(schema: JsonSchema): string | undefined {
  if (!schema) {
    return undefined;
  }
  if (Array.isArray(schema.type)) {
    const filtered = schema.type.filter((t) => t !== "null");
    return filtered[0] ?? schema.type[0];
  }
  return schema.type;
}

function getSchemaDefaultValue(schema?: JsonSchema): unknown {
  if (!schema) {
    return "";
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  const type = getSchemaType(schema);
  switch (type) {
    case "object":
      return {};
    case "array":
      return [];
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "string":
      return "";
    default:
      return "";
  }
}

function humanize(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (m) => m.toUpperCase());
}

function getHintForPath(path: Array<string | number>, hints: Record<string, { label?: string; help?: string; placeholder?: string; order?: number | string; sensitive?: boolean }>) {
  const key = path.filter((s) => typeof s === "string").join(".");
  return hints[key];
}

function isSensitiveField(path: Array<string | number>): boolean {
  const key = path.filter((s) => typeof s === "string").join(".").toLowerCase();
  return (
    key.includes("token") ||
    key.includes("password") ||
    key.includes("secret") ||
    key.includes("apikey") ||
    key.endsWith("key")
  );
}

function Field({ schema, value, path, disabled, onPatch, hints, showLabel = true }: FieldProps) {
  const type = getSchemaType(schema);
  const hint = getHintForPath(path, hints);
  const label = hint?.label ?? schema.title ?? humanize(String(path.at(-1) ?? "Field"));
  const help = hint?.help ?? schema.description;
  const isSensitive = hint?.sensitive ?? isSensitiveField(path);
  const key = path.join(".");

  // Check for enum
  const enumValues = schema.enum;
  if (enumValues && enumValues.length > 0) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{label}</Label>}
        {help && <p className="text-xs text-muted-foreground">{help}</p>}
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={String(value ?? enumValues[0])}
          disabled={disabled}
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10);
            onPatch(path, enumValues[idx]);
          }}
        >
          {enumValues.map((opt, idx) => (
            <option key={idx} value={idx}>
              {String(opt)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Boolean field
  if (type === "boolean") {
    const checked = typeof value === "boolean" ? value : schema.default === true;
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/30">
        <div className="flex-1">
          <Label className="cursor-pointer">{label}</Label>
          {help && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onPatch(path, !checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            checked ? "bg-accent" : "bg-muted"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    );
  }

  // Object field
  if (type === "object") {
    const obj = (value as Record<string, unknown>) ?? {};
    const properties = schema.properties ?? {};

    const entries = Object.entries(properties);
    // Sort by hint order if available
    entries.sort((keyA, keyB) => {
      const pathA = [...path, keyA[0]];
      const pathB = [...path, keyB[0]];
      const keyStrA = pathA.filter((s) => typeof s === "string").join(".");
      const keyStrB = pathB.filter((s) => typeof s === "string").join(".");
      const hintA = hints[keyStrA];
      const hintB = hints[keyStrB];
      const orderA = hintA?.order ? Number(hintA.order) : 50;
      const orderB = hintB?.order ? Number(hintB.order) : 50;
      return orderA - orderB;
    });

    // Top-level object - render flat
    if (path.length === 0) {
      return (
        <div className="space-y-4">
          {entries.map(([propKey, propSchema]) => (
            <Field
              key={propKey}
              schema={propSchema as JsonSchema}
              value={obj[propKey]}
              path={[...path, propKey]}
              disabled={disabled}
              onPatch={onPatch}
              hints={hints}
            />
          ))}
        </div>
      );
    }

    // Nested object - render as collapsible card
    return (
      <Collapsible defaultOpen className="group">
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{label}</CardTitle>
                <Icons.chevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </div>
              {help && <CardDescription>{help}</CardDescription>}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {entries.map(([propKey, propSchema]) => (
                <Field
                  key={propKey}
                  schema={propSchema as JsonSchema}
                  value={obj[propKey]}
                  path={[...path, propKey]}
                  disabled={disabled}
                  onPatch={onPatch}
                  hints={hints}
                />
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  // Array field - simple implementation
  if (type === "array") {
    const arr = Array.isArray(value) ? value : [];
    const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{label}</CardTitle>
              {help && <CardDescription>{help}</CardDescription>}
            </div>
            <span className="text-xs text-muted-foreground">
              {arr.length} item{arr.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {arr.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No items</p>
          ) : (
            arr.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                <span className="text-xs text-muted-foreground mt-1">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <Field
                    schema={(itemsSchema ?? { type: "string" }) as JsonSchema}
                    value={item}
                    path={[...path, idx]}
                    disabled={disabled}
                    onPatch={onPatch}
                    hints={hints}
                    showLabel={false}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    const next = [...arr];
                    next.splice(idx, 1);
                    onPatch(path, next);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <Icons.trash className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              const defaultVal = getSchemaDefaultValue((itemsSchema ?? { type: "string" }) as JsonSchema);
              const next = [...arr, defaultVal];
              onPatch(path, next);
            }}
            className="w-full"
          >
            <Icons.plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Number field
  if (type === "number" || type === "integer") {
    const defaultVal = typeof schema.default === "number" ? schema.default : 0;
    const currentVal = typeof value === "number" ? value : defaultVal;

    return (
      <div className="space-y-2">
        {showLabel && <Label htmlFor={key}>{label}</Label>}
        {help && <p className="text-xs text-muted-foreground">{help}</p>}
        <Input
          id={key}
          type="number"
          value={currentVal}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              onPatch(path, undefined);
              return;
            }
            onPatch(path, type === "integer" ? parseInt(val, 10) : parseFloat(val));
          }}
        />
      </div>
    );
  }

  // String field (default)
  const defaultStr = typeof schema.default === "string" ? schema.default : "";
  const currentStr = typeof value === "string" ? value : defaultStr;

  return (
    <div className="space-y-2">
      {showLabel && <Label htmlFor={key}>{label}</Label>}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {isSensitive ? (
        <Input
          id={key}
          type="password"
          value={currentStr}
          disabled={disabled}
          onChange={(e) => onPatch(path, e.target.value)}
          placeholder="••••"
        />
      ) : (
        <Input
          id={key}
          type="text"
          value={currentStr}
          disabled={disabled}
          onChange={(e) => onPatch(path, e.target.value)}
          placeholder={hint?.placeholder ?? `Default: ${schema.default ?? ""}`}
        />
      )}
    </div>
  );
}
