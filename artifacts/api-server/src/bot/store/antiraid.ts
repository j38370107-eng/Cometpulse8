import { logger } from "../../lib/logger";
import { dbSet, dbGetAll } from "./db";

const STORE = "antiraid";

export type AntiRaidAction = "ban" | "kick" | "mute";

export interface AntiRaidConfig {
  enabled: boolean;
  joinThreshold: number;
  joinWindowMs: number;
  action: AntiRaidAction;
  lockdown: boolean;
  logChannel?: string;
}

const DEFAULT: AntiRaidConfig = {
  enabled: false,
  joinThreshold: 10,
  joinWindowMs: 10_000,
  action: "kick",
  lockdown: false,
};

const cache = new Map<string, AntiRaidConfig>();

export async function initAntiraidStore(): Promise<void> {
  const rows = await dbGetAll<AntiRaidConfig>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded antiraid store from DB");
}

function save(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId)!).catch((err) =>
    logger.error({ err }, "Failed to save antiraid config")
  );
}

export function getAntiRaid(guildId: string): AntiRaidConfig {
  return cache.get(guildId) ?? { ...DEFAULT };
}

export function resetAntiRaidConfig(guildId: string): void {
  const fresh: AntiRaidConfig = { ...DEFAULT };
  cache.set(guildId, fresh);
  dbSet(STORE, guildId, fresh).catch((err) => logger.error({ err }, "Failed to reset antiraid config"));
}

export function updateAntiRaid(guildId: string, partial: Partial<AntiRaidConfig>): AntiRaidConfig {
  const updated = { ...getAntiRaid(guildId), ...partial };
  cache.set(guildId, updated);
  save(guildId);
  return updated;
}
