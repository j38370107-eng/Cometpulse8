import { logger } from "../../lib/logger";
import { dbSet, dbGetAll } from "./db";

const STORE = "antinuke";

export type AntiNukeAction = "ban" | "kick" | "strip";

export interface AntiNukeThresholds {
  channelDelete: number;
  channelCreate: number;
  roleDelete: number;
  roleCreate: number;
  ban: number;
  kick: number;
  webhookCreate: number;
}

export interface AntiNukeConfig {
  enabled: boolean;
  action: AntiNukeAction;
  thresholds: AntiNukeThresholds;
  windowMs: number;
  whitelist: string[];
  logChannel?: string;
}

const DEFAULT: AntiNukeConfig = {
  enabled: false,
  action: "ban",
  thresholds: {
    channelDelete: 3,
    channelCreate: 5,
    roleDelete: 3,
    roleCreate: 5,
    ban: 3,
    kick: 5,
    webhookCreate: 3,
  },
  windowMs: 10_000,
  whitelist: [],
};

const cache = new Map<string, AntiNukeConfig>();

export async function initAntinukeStore(): Promise<void> {
  const rows = await dbGetAll<AntiNukeConfig>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded antinuke store from DB");
}

function save(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId)!).catch((err) =>
    logger.error({ err }, "Failed to save antinuke config")
  );
}

export function getAntiNuke(guildId: string): AntiNukeConfig {
  return cache.get(guildId) ?? { ...DEFAULT, thresholds: { ...DEFAULT.thresholds }, whitelist: [] };
}

export function setAntiNuke(guildId: string, cfg: AntiNukeConfig): void {
  cache.set(guildId, cfg);
  save(guildId);
}

export function resetAntiNukeConfig(guildId: string): void {
  const fresh: AntiNukeConfig = { ...DEFAULT, thresholds: { ...DEFAULT.thresholds }, whitelist: [] };
  cache.set(guildId, fresh);
  dbSet(STORE, guildId, fresh).catch((err) => logger.error({ err }, "Failed to reset antinuke config"));
}

export function updateAntiNuke(guildId: string, partial: Partial<AntiNukeConfig>): AntiNukeConfig {
  const updated = { ...getAntiNuke(guildId), ...partial };
  cache.set(guildId, updated);
  save(guildId);
  return updated;
}
