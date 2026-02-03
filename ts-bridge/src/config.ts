import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import type { BridgeConfig } from "./types";

interface OpenClawJson {
  gateway?: {
    port?: number;
    auth?: {
      token?: string;
    };
  };
}

interface BridgeJson {
  webhook_url?: string;
  agent_id?: string;
  uid?: string;
}

export function configDir(): string {
  return join(homedir(), ".openclaw");
}

export function bridgeConfigPath(): string {
  return join(configDir(), "bridge.json");
}

export function openclawConfigPath(): string {
  return join(configDir(), "openclaw.json");
}

export async function loadConfig(): Promise<BridgeConfig> {
  const gatewayRaw = await readFile(openclawConfigPath(), "utf8").catch(() => {
    throw new Error("Missing ~/.openclaw/openclaw.json");
  });
  const gatewayJson = JSON.parse(gatewayRaw) as OpenClawJson;
  const bridgeRaw = await readFile(bridgeConfigPath(), "utf8").catch(() => {
    throw new Error(
      "Missing ~/.openclaw/bridge.json. Run with webhook_url=ws://...",
    );
  });
  const bridgeJson = JSON.parse(bridgeRaw) as BridgeJson;

  if (!bridgeJson.webhook_url) {
    throw new Error("bridge.json is missing webhook_url");
  }

  const gatewayPort = gatewayJson.gateway?.port ?? 18789;
  const gatewayToken = gatewayJson.gateway?.auth?.token ?? "";
  const agentId = bridgeJson.agent_id ?? "main";
  const uid = bridgeJson.uid ?? randomUUID();

  return {
    webhookUrl: bridgeJson.webhook_url,
    openclaw: {
      gatewayPort,
      gatewayToken,
      agentId,
    },
    uid,
  };
}

export async function applyConfigArgs(args: string[]): Promise<void> {
  const kv = parseKeyValue(args);
  let webhookUrl = kv.webhook_url;

  if (!webhookUrl) {
    const reader = createInterface({ input, output });
    webhookUrl = (
      await reader.question(
        "Enter WebSocket URL (e.g., ws://localhost:8080/ws): ",
      )
    ).trim();
    await reader.close();
    if (!webhookUrl) {
      throw new Error("webhook_url is required");
    }
  }

  const existing = await readFile(bridgeConfigPath(), "utf8").catch(() => "");
  const json = existing ? (JSON.parse(existing) as BridgeJson) : {};
  json.webhook_url = webhookUrl;
  if (kv.agent_id) {
    json.agent_id = kv.agent_id;
  }

  await writeFile(bridgeConfigPath(), JSON.stringify(json, null, 2), {
    mode: 0o600,
  });
  output.write(`Saved config to ${bridgeConfigPath()}\n`);
}

function parseKeyValue(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of args) {
    const [key, value] = arg.split("=", 2);
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}
