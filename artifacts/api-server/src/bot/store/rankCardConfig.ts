import { logger } from "../../lib/logger";
import { dbSet, dbGetAll } from "./db";

const STORE = "rankCardConfig";

export interface RankCardConfig {
  bgColor1?: string;
  bgColor2?: string;
  accentColor?: string;
  bgImageUrl?: string;
}

const DEFAULT: Required<RankCardConfig> = {
  bgColor1: "#0b0120",
  bgColor2: "#18064a",
  accentColor: "#7c3cfa",
  bgImageUrl: "",
};

const cache = new Map<string, RankCardConfig>();

export async function initRankCardConfigStore(): Promise<void> {
  const rows = await dbGetAll<RankCardConfig>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded rankCardConfig store from DB");
}

export function getRankCardConfig(guildId: string): Required<RankCardConfig> {
  return { ...DEFAULT, ...(cache.get(guildId) ?? {}) };
}

export function setRankCardConfig(guildId: string, cfg: RankCardConfig): void {
  cache.set(guildId, cfg);
  dbSet(STORE, guildId, cfg).catch((err) =>
    logger.error({ err }, "Failed to save rankCardConfig")
  );
}
