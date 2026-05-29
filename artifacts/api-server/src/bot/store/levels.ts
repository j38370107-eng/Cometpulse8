import { logger } from "../../lib/logger";
import { dbSet, dbGetAll, dbDelete } from "./db";

const STORE = "levels";
const CONFIG_STORE = "levelconfig";

export interface UserLevel {
  xp: number;
  level: number;
}

export interface LevelRoleReward {
  level: number;
  roleId: string;
}

export interface RoleMultiplier {
  roleId: string;
  multiplier: number;
}

export interface ChannelMultiplier {
  channelId: string;
  multiplier: number;
}

export interface LevelConfig {
  enabled: boolean;
  channelId: string | null;
  xpRate: number;
  roleRewards: LevelRoleReward[];
  noXpRoles: string[];
  noXpChannels: string[];
  multiplierRoles: RoleMultiplier[];
  multiplierChannels: ChannelMultiplier[];
  boosterMultiplier: number;
  doubleXpActive: boolean;
  doubleXpEnd: number | null;
  dmOnLevelUp: boolean;
  levelUpMessage: string | null;
  roleStack: boolean;
}

const userCache = new Map<string, UserLevel>();
const configCache = new Map<string, LevelConfig>();
const xpCooldown = new Map<string, number>();

export const DEFAULT_CONFIG: LevelConfig = {
  enabled: true,
  channelId: null,
  xpRate: 1,
  roleRewards: [],
  noXpRoles: [],
  noXpChannels: [],
  multiplierRoles: [],
  multiplierChannels: [],
  boosterMultiplier: 1.5,
  doubleXpActive: false,
  doubleXpEnd: null,
  dmOnLevelUp: false,
  levelUpMessage: null,
  roleStack: true,
};

export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += xpForLevel(i);
  return total;
}

export function levelFromXp(totalXp: number): number {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return level;
}

export function xpInCurrentLevel(totalXp: number): number {
  const level = levelFromXp(totalXp);
  return totalXp - totalXpForLevel(level);
}

function userKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function save(key: string, data: UserLevel): void {
  dbSet(STORE, key, data).catch((err) => logger.error({ err }, "Failed to save level data"));
}

function saveConfig(guildId: string, config: LevelConfig): void {
  dbSet(CONFIG_STORE, guildId, config).catch((err) =>
    logger.error({ err }, "Failed to save level config"),
  );
}

export async function initLevelsStore(): Promise<void> {
  const [rows, configRows] = await Promise.all([
    dbGetAll<UserLevel>(STORE),
    dbGetAll<LevelConfig>(CONFIG_STORE),
  ]);
  for (const { key, data } of rows) userCache.set(key, data);
  for (const { key, data } of configRows) {
    configCache.set(key, { ...DEFAULT_CONFIG, ...data });
  }
  logger.info({ users: rows.length, guilds: configRows.length }, "Loaded levels store from DB");
}

export function getLevelConfig(guildId: string): LevelConfig {
  return { ...DEFAULT_CONFIG, ...(configCache.get(guildId) ?? {}) };
}

export function setLevelConfig(guildId: string, config: LevelConfig): void {
  configCache.set(guildId, config);
  saveConfig(guildId, config);
}

export function getUserLevel(guildId: string, userId: string): UserLevel {
  return userCache.get(userKey(guildId, userId)) ?? { xp: 0, level: 0 };
}

export function setUserLevel(guildId: string, userId: string, data: UserLevel): void {
  const key = userKey(guildId, userId);
  userCache.set(key, data);
  save(key, data);
}

export function resetUserLevel(guildId: string, userId: string): void {
  const key = userKey(guildId, userId);
  userCache.delete(key);
  dbDelete(STORE, key).catch((err) => logger.error({ err }, "Failed to delete level data"));
}

export function resetGuildLevels(guildId: string): number {
  const prefix = `${guildId}:`;
  let count = 0;
  for (const key of [...userCache.keys()]) {
    if (key.startsWith(prefix)) {
      userCache.delete(key);
      dbDelete(STORE, key).catch(() => {});
      count++;
    }
  }
  return count;
}

export function getLeaderboard(
  guildId: string,
  limit = 10,
): Array<{ userId: string; xp: number; level: number }> {
  const prefix = `${guildId}:`;
  const entries: Array<{ userId: string; xp: number; level: number }> = [];
  for (const [key, data] of userCache.entries()) {
    if (!key.startsWith(prefix)) continue;
    const userId = key.slice(prefix.length);
    entries.push({ userId, xp: data.xp, level: data.level });
  }
  return entries.sort((a, b) => b.xp - a.xp).slice(0, limit);
}

export function getUserRank(guildId: string, userId: string): number {
  const prefix = `${guildId}:`;
  const myXp = userCache.get(userKey(guildId, userId))?.xp ?? 0;
  let rank = 1;
  for (const [key, data] of userCache.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (key === userKey(guildId, userId)) continue;
    if (data.xp > myXp) rank++;
  }
  return rank;
}

export function exportGuildXp(
  guildId: string,
): Array<{ userId: string; xp: number; level: number }> {
  const prefix = `${guildId}:`;
  const entries: Array<{ userId: string; xp: number; level: number }> = [];
  for (const [key, data] of userCache.entries()) {
    if (!key.startsWith(prefix)) continue;
    entries.push({ userId: key.slice(prefix.length), xp: data.xp, level: data.level });
  }
  return entries;
}

export function importGuildXp(
  guildId: string,
  entries: Array<{ userId: string; xp: number; level?: number }>,
): number {
  let count = 0;
  for (const entry of entries) {
    if (!entry.userId || typeof entry.xp !== "number") continue;
    const level = entry.level ?? levelFromXp(entry.xp);
    setUserLevel(guildId, entry.userId, { xp: Math.max(0, entry.xp), level });
    count++;
  }
  return count;
}

function isDoubleXpActive(config: LevelConfig): boolean {
  if (!config.doubleXpActive) return false;
  if (config.doubleXpEnd !== null && Date.now() > config.doubleXpEnd) return false;
  return true;
}

const XP_MIN = 15;
const XP_MAX = 25;
const XP_COOLDOWN_MS = 60_000;

export function tryAddXp(
  guildId: string,
  userId: string,
  config: LevelConfig,
  context?: { memberRoleIds?: string[]; channelId?: string; isBooster?: boolean },
): { leveled: boolean; newLevel: number; gained: number } | null {
  const cdKey = `${guildId}:${userId}`;
  const last = xpCooldown.get(cdKey) ?? 0;
  if (Date.now() - last < XP_COOLDOWN_MS) return null;
  xpCooldown.set(cdKey, Date.now());

  let multiplier = config.xpRate;

  if (context?.memberRoleIds && config.multiplierRoles.length > 0) {
    let bestRole = 1;
    for (const rm of config.multiplierRoles) {
      if (context.memberRoleIds.includes(rm.roleId) && rm.multiplier > bestRole) {
        bestRole = rm.multiplier;
      }
    }
    multiplier *= bestRole;
  }

  if (context?.channelId && config.multiplierChannels.length > 0) {
    const cm = config.multiplierChannels.find((c) => c.channelId === context.channelId);
    if (cm) multiplier *= cm.multiplier;
  }

  if (context?.isBooster && config.boosterMultiplier > 1) {
    multiplier *= config.boosterMultiplier;
  }

  if (isDoubleXpActive(config)) {
    multiplier *= 2;
  }

  const base = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1) + XP_MIN);
  const gained = Math.max(1, Math.round(base * multiplier));

  const current = getUserLevel(guildId, userId);
  const newXp = current.xp + gained;
  const newLevel = levelFromXp(newXp);
  const leveled = newLevel > current.level;

  setUserLevel(guildId, userId, { xp: newXp, level: newLevel });
  return { leveled, newLevel, gained };
}
