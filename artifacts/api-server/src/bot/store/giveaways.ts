import { dbGet, dbSet, dbGetAll } from "./db";
import { logger } from "../../lib/logger";

export interface GiveawayEntry {
  userId: string;
  bonusEntries: number;
  totalEntries: number;
}

export interface GiveawayRequirements {
  requiredRoles: string[];
  blacklistRoles: string[];
  minAccountAgeDays: number;
  minServerAgeDays: number;
  minLevel: number;
  minMessages: number;
}

export interface BonusRule {
  roleId: string;
  bonus: number;
}

export interface GiveawayBonusConfig {
  roleMultipliers: BonusRule[];
  levelBonuses: Array<{ minLevel: number; bonus: number }>;
  boosterBonus: number;
  boosterEnabled: boolean;
}

export type GiveawayType = "normal" | "role-locked" | "level-gated" | "partner";

export interface Giveaway {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  hostId: string;
  prize: string;
  description: string;
  winnerCount: number;
  endsAt: number;
  ended: boolean;
  cancelled: boolean;
  type: GiveawayType;
  partnerServer: string;
  requirements: GiveawayRequirements;
  bonus: GiveawayBonusConfig;
  entries: GiveawayEntry[];
  winners: string[];
  createdAt: number;
}

export interface GiveawayConfig {
  managerRoleId: string;
  announceChannelId: string;
  boosterBonusAmount: number;
}

const STORE = "giveaways";
const CFG_STORE = "giveawayConfig";

const cache = new Map<string, Record<string, Giveaway>>();
const configCache = new Map<string, GiveawayConfig>();
const byMessageId = new Map<string, Giveaway>();

function defaultReqs(): GiveawayRequirements {
  return {
    requiredRoles: [],
    blacklistRoles: [],
    minAccountAgeDays: 0,
    minServerAgeDays: 0,
    minLevel: 0,
    minMessages: 0,
  };
}

function defaultBonus(): GiveawayBonusConfig {
  return {
    roleMultipliers: [],
    levelBonuses: [],
    boosterBonus: 1,
    boosterEnabled: false,
  };
}

function defaultCfg(): GiveawayConfig {
  return { managerRoleId: "", announceChannelId: "", boosterBonusAmount: 1 };
}

async function persist(guildId: string): Promise<void> {
  await dbSet(STORE, guildId, cache.get(guildId) ?? {});
}

export function getGiveaways(guildId: string): Record<string, Giveaway> {
  return cache.get(guildId) ?? {};
}

export function getGiveaway(guildId: string, id: string): Giveaway | undefined {
  return cache.get(guildId)?.[id];
}

export function getGiveawayByMessage(messageId: string): Giveaway | undefined {
  return byMessageId.get(messageId);
}

export function getActiveGiveaways(guildId: string): Giveaway[] {
  return Object.values(cache.get(guildId) ?? {}).filter(g => !g.ended && !g.cancelled);
}

export function getAllActiveGiveaways(): Giveaway[] {
  const out: Giveaway[] = [];
  for (const gmap of cache.values()) {
    for (const g of Object.values(gmap)) {
      if (!g.ended && !g.cancelled) out.push(g);
    }
  }
  return out;
}

export async function createGiveaway(
  data: Omit<Giveaway, "id" | "entries" | "winners" | "ended" | "cancelled" | "createdAt">
): Promise<Giveaway> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const giveaway: Giveaway = {
    ...data,
    id,
    entries: [],
    winners: [],
    ended: false,
    cancelled: false,
    createdAt: Date.now(),
    requirements: { ...defaultReqs(), ...data.requirements },
    bonus: { ...defaultBonus(), ...data.bonus },
  };

  if (!cache.has(data.guildId)) cache.set(data.guildId, {});
  cache.get(data.guildId)![id] = giveaway;
  byMessageId.set(data.messageId, giveaway);

  await persist(data.guildId);
  return giveaway;
}

export async function updateGiveaway(
  guildId: string,
  id: string,
  updates: Partial<Giveaway>
): Promise<void> {
  const map = cache.get(guildId);
  if (!map?.[id]) return;
  if (updates.messageId && updates.messageId !== map[id].messageId) {
    byMessageId.delete(map[id].messageId);
    byMessageId.set(updates.messageId, map[id]);
  }
  Object.assign(map[id], updates);
  await persist(guildId);
}

export async function addEntry(
  guildId: string,
  giveawayId: string,
  entry: GiveawayEntry
): Promise<boolean> {
  const g = cache.get(guildId)?.[giveawayId];
  if (!g) return false;
  if (g.entries.some(e => e.userId === entry.userId)) return false;
  g.entries.push(entry);
  await persist(guildId);
  return true;
}

export async function giveManualBonus(
  guildId: string,
  giveawayId: string,
  userId: string,
  bonus: number
): Promise<boolean> {
  const g = cache.get(guildId)?.[giveawayId];
  if (!g) return false;
  const entry = g.entries.find(e => e.userId === userId);
  if (!entry) return false;
  entry.bonusEntries = Math.max(0, entry.bonusEntries + bonus);
  entry.totalEntries = 1 + entry.bonusEntries;
  await persist(guildId);
  return true;
}

export function getGiveawayConfig(guildId: string): GiveawayConfig {
  return configCache.get(guildId) ?? defaultCfg();
}

export async function setGiveawayConfig(guildId: string, cfg: Partial<GiveawayConfig>): Promise<void> {
  const existing = configCache.get(guildId) ?? defaultCfg();
  const updated = { ...existing, ...cfg };
  configCache.set(guildId, updated);
  await dbSet(CFG_STORE, guildId, updated);
}

export async function initGiveawaysStore(): Promise<void> {
  const [gRows, cfgRows] = await Promise.all([
    dbGetAll<Record<string, Giveaway>>(STORE),
    dbGetAll<GiveawayConfig>(CFG_STORE),
  ]);

  for (const row of gRows) {
    const guildId = row.key;
    const map = row.data ?? {};
    cache.set(guildId, map);
    for (const g of Object.values(map)) {
      byMessageId.set(g.messageId, g);
    }
  }

  for (const row of cfgRows) {
    configCache.set(row.key, row.data);
  }

  logger.info(`Giveaways store initialized (${gRows.length} guilds)`);
}
