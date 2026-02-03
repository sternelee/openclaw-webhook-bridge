import type { BridgeConfig } from "./types";
import { OpenClawClient } from "./openclaw/client";
import { WebhookClient } from "./webhook/client";

interface WebhookPayload {
  id?: string;
  content?: string;
  session?: string;
  type?: string;
}

export class Bridge {
  private webhookClient: WebhookClient;
  private openclawClient: OpenClawClient;

  constructor(config: BridgeConfig) {
    this.openclawClient = new OpenClawClient(
      config.openclaw.gatewayPort,
      config.openclaw.gatewayToken,
      config.openclaw.agentId,
    );
    this.webhookClient = new WebhookClient(
      config.webhookUrl,
      async (data) => this.handleWebhookMessage(data),
      config.uid,
    );
    this.openclawClient.setEventHandler(async (data) =>
      this.handleOpenClawEvent(data),
    );
  }

  async start(): Promise<void> {
    await this.openclawClient.connect();
    await this.webhookClient.connect();
  }

  async stop(): Promise<void> {
    await this.webhookClient.close();
    await this.openclawClient.close();
  }

  private async handleWebhookMessage(data: string): Promise<void> {
    const payload = safeParse(data);
    if (!payload) {
      return;
    }

    if (
      payload.type &&
      ["connected", "error", "event"].includes(payload.type)
    ) {
      return;
    }

    if (!payload.content) {
      return;
    }

    const sessionKey = payload.session ?? `webhook:${payload.id ?? Date.now()}`;
    await this.openclawClient.sendAgentRequest(payload.content, sessionKey);
  }

  private async handleOpenClawEvent(data: string): Promise<void> {
    await this.webhookClient.send(data);
  }
}

function safeParse(data: string): WebhookPayload | null {
  try {
    return JSON.parse(data) as WebhookPayload;
  } catch {
    return null;
  }
}
