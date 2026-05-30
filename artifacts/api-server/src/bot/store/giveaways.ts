import { logger } from "../../lib/logger";
import { dbSet, dbGetAll, dbDelete } from "./db";

export const GIVEAWAY_STORE = "giveaways";
export const GIVEAWAY_CONFIG_STORE = "giveawayConfig";

export interface GiveawayEntry {
  userId: string;
  entries: number;
}

export interface GiveawayRequirements {
  requiredRoles: string[];
  blacklistRoles: string[];
  minDays: number;
  minLevel: number;
}

export interface BonusRoleEntry {
  roleId: string;
  entries: number;
}

export interface LevelBonusEntry {
  minLevel: number;
  bonusEntries: number;
}

export type GiveawayType = "normal" | "role-locked" | "level-gated" | "partner";

export interface Giveaway {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  hostId: string;
  winnerCount: number;
  endTime: number;
  ended: boolean;
  cancelled: boolean;
  type: GiveawayType;
  requirements: GiveawayRequirements;
  bonusRoles: BonusRoleEntry[];
  levelBonuses: LevelBonusEntry[];
  boosterBonus: number;
  entries: GiveawayEntry[];
  winners: string[];
  announcementChannelId: string | null;
  partnerInfo: { serverId: string; serverName: string } | null;
}

export interface GiveawayConfig {
  announcementChannelId: string | null;
  defaultBoosterBonus: number;
  defaultRequiredRoles: string[];
  defaultBlacklistRoles: string[];
  defaultBonusRoles: BonusRoleEntry[];
  defaultLevelBonuses: LevelBonusEntry[];
  managerRoles: string[];
}

export const DEFAULT_GIVEAWAY_CONFIG: GiveawayConfig = {
  announcementChannelId: null,
  defaultBoosterBonus: 0,
  defaultRequiredRoles: [],
  defaultBlacklistRoles: [],
  defaultBonusRoles: [],
  defaultLevelBonuses: [],
  managerRoles: [],
};

const giveawayCache = new Map<string, Giveaway>();
const configCache = new Map<string, GiveawayConfig>();

function gKey(guildId: string, id: string): string {
  return `${guildId}:${id}`;
}

export async function initGiveawaysStore(): Promise<void> {
  const [giveaways, configs] = await Promise.all([
    dbGetAll<Giveaway>(GIVEAWAY_STORE),
    dbGetAll<GiveawayConfig>(GIVEAWAY_CONFIG_STORE),
  ]);
  for (const { key, data } of giveaways) giveawayCache.set(key, data);
  for (const { key, data } of configs) {
    configCache.set(key, { ...DEFAULT_GIVEAWAY_CONFIG, ...data });
  }
  logger.info({ count: giveaways.length }, "Loaded giveaways from DB");
}

export function getGiveawayConfig(guildId: string): GiveawayConfig {
  return { ...DEFAULT_GIVEAWAY_CONFIG, ...(configCache.get(guildId) ?? {}) };
}

export function setGiveawayConfig(guildId: string, config: GiveawayConfig): void {
  configCache.set(guildId, config);
  dbSet(GIVEAWAY_CONFIG_STORE, guildId, config).catch((err) =>
    logger.error({ err }, "Failed to save giveaway config")
  );
}

export function getGiveaway(guildId: string, id: string): Giveaway | null {
  return giveawayCache.get(gKey(guildId, id)) ?? null;
}

export function getGiveawayByMessageId(guildId: string, messageId: string): Giveaway | null {
  const prefix = `${guildId}:`;
  for (const [key, g] of giveawayCache) {
    if (key.startsWith(prefix) && g.messageId === messageId) return g;
  }
  return null;
}

export function getAllGiveaways(guildId: string): Giveaway[] {
  const prefix = `${guildId}:`;
  const result: Giveaway[] = [];
  for (const [key, g] of giveawayCache) {
    if (key.startsWith(prefix)) result.push(g);
  }
  return result;
}

export function getActiveGiveaways(guildId: string): Giveaway[] {
  return getAllGiveaways(guildId).filter((g) => !g.ended && !g.cancelled);
}

export function getAllActiveGiveawaysGlobal(): Giveaway[] {
  const result: Giveaway[] = [];
  for (const g of giveawayCache.values()) {
    if (!g.ended && !g.cancelled) result.push(g);
  }
  return result;
}

export function saveGiveaway(g: Giveaway): void {
  giveawayCache.set(gKey(g.guildId, g.id), g);
  dbSet(GIVEAWAY_STORE, gKey(g.guildId, g.id), g).catch((err) =>
    logger.error({ err }, "Failed to save giveaway")
  );
}

export function deleteGiveaway(guildId: string, id: string): void {
  giveawayCache.delete(gKey(guildId, id));
  dbDelete(GIVEAWAY_STORE, gKey(guildId, id)).catch(() => {});
}
