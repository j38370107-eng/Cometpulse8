import { dbGet, dbSet } from "./db";

const STORE = "welcome";

export interface WelcomeConfig {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeEmbed: boolean;
  welcomeMessage: string;
  welcomeEmbedColor: string;
  welcomeEmbedTitle: string;
  welcomeEmbedFooter: string;

  goodbyeEnabled: boolean;
  goodbyeChannelId: string | null;
  goodbyeEmbed: boolean;
  goodbyeMessage: string;
  goodbyeEmbedColor: string;
  goodbyeEmbedTitle: string;
  goodbyeEmbedFooter: string;

  autoRoleEnabled: boolean;
  autoRoles: string[];
  botAutoRoles: string[];

  dmEnabled: boolean;
  dmMessage: string;

  showInviter: boolean;
}

export const DEFAULT_WELCOME_CONFIG: WelcomeConfig = {
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeEmbed: true,
  welcomeMessage: "Welcome to **{server}**, {user}! You are member **#{count}**.",
  welcomeEmbedColor: "#7c3cfa",
  welcomeEmbedTitle: "👋 Welcome!",
  welcomeEmbedFooter: "",

  goodbyeEnabled: false,
  goodbyeChannelId: null,
  goodbyeEmbed: false,
  goodbyeMessage: "**{username}** has left **{server}**. They were here for {duration}.",
  goodbyeEmbedColor: "#ef4444",
  goodbyeEmbedTitle: "Goodbye",
  goodbyeEmbedFooter: "",

  autoRoleEnabled: false,
  autoRoles: [],
  botAutoRoles: [],

  dmEnabled: false,
  dmMessage: "Welcome to **{server}**! We're glad to have you here. 🎉",

  showInviter: true,
};

const cache = new Map<string, WelcomeConfig>();

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig> {
  if (cache.has(guildId)) return cache.get(guildId)!;
  const stored = await dbGet<WelcomeConfig>(STORE, guildId);
  const config: WelcomeConfig = { ...DEFAULT_WELCOME_CONFIG, ...(stored ?? {}) };
  cache.set(guildId, config);
  return config;
}

export async function saveWelcomeConfig(guildId: string, config: WelcomeConfig): Promise<void> {
  cache.set(guildId, config);
  await dbSet(STORE, guildId, config);
}

export function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const mo = Math.floor(d / 30);
  const y = Math.floor(d / 365);
  if (y > 0) return `${y}y ${Math.floor((d % 365) / 30)}mo`;
  if (mo > 0) return `${mo}mo ${d % 30}d`;
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
