export interface OpenClawConfig {
  gatewayPort: number;
  gatewayToken: string;
  agentId: string;
}

export interface BridgeConfig {
  webhookUrl: string;
  openclaw: OpenClawConfig;
  uid: string;
}
