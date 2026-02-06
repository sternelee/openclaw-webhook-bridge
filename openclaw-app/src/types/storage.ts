/**
 * LocalStorage types for UI settings persistence.
 */

export type ThemeMode = "light" | "dark" | "system";

export interface UiSettings {
  gatewayUrl: string;
  token: string;
  uid: string; // Bridge UID for routing via cloudflare-webhook
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: ThemeMode;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number; // Sidebar split ratio (0.4 to 0.7, default 0.6)
  navCollapsed: boolean; // Collapsible sidebar state
  navGroupsCollapsed: Record<string, boolean>; // Which nav groups are collapsed
}

export const STORAGE_KEY = "openclaw.control.settings.v1";

export const DEFAULT_SETTINGS: Omit<UiSettings, "gatewayUrl"> = {
  token: "",
  uid: "",
  sessionKey: "main",
  lastActiveSessionKey: "main",
  theme: "system",
  chatFocusMode: false,
  chatShowThinking: true,
  splitRatio: 0.6,
  navCollapsed: false,
  navGroupsCollapsed: {},
};

export function getDefaultGatewayUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:18789";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

export function loadSettings(): UiSettings {
  if (typeof window === "undefined") {
    return {
      gatewayUrl: getDefaultGatewayUrl(),
      ...DEFAULT_SETTINGS,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        gatewayUrl: getDefaultGatewayUrl(),
        ...DEFAULT_SETTINGS,
      };
    }
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      gatewayUrl:
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : getDefaultGatewayUrl(),
      token: typeof parsed.token === "string" ? parsed.token : DEFAULT_SETTINGS.token,
      uid: typeof parsed.uid === "string" ? parsed.uid : DEFAULT_SETTINGS.uid,
      sessionKey:
        typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()
          ? parsed.sessionKey.trim()
          : DEFAULT_SETTINGS.sessionKey,
      lastActiveSessionKey:
        typeof parsed.lastActiveSessionKey === "string" && parsed.lastActiveSessionKey.trim()
          ? parsed.lastActiveSessionKey.trim()
          : DEFAULT_SETTINGS.lastActiveSessionKey,
      theme:
        parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
          ? parsed.theme
          : DEFAULT_SETTINGS.theme,
      chatFocusMode:
        typeof parsed.chatFocusMode === "boolean"
          ? parsed.chatFocusMode
          : DEFAULT_SETTINGS.chatFocusMode,
      chatShowThinking:
        typeof parsed.chatShowThinking === "boolean"
          ? parsed.chatShowThinking
          : DEFAULT_SETTINGS.chatShowThinking,
      splitRatio:
        typeof parsed.splitRatio === "number" &&
        parsed.splitRatio >= 0.4 &&
        parsed.splitRatio <= 0.7
          ? parsed.splitRatio
          : DEFAULT_SETTINGS.splitRatio,
      navCollapsed:
        typeof parsed.navCollapsed === "boolean"
          ? parsed.navCollapsed
          : DEFAULT_SETTINGS.navCollapsed,
      navGroupsCollapsed:
        typeof parsed.navGroupsCollapsed === "object" && parsed.navGroupsCollapsed !== null
          ? parsed.navGroupsCollapsed
          : DEFAULT_SETTINGS.navGroupsCollapsed,
    };
  } catch {
    return {
      gatewayUrl: getDefaultGatewayUrl(),
      ...DEFAULT_SETTINGS,
    };
  }
}

export function saveSettings(settings: UiSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
