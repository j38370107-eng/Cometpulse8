import { logger } from "../../lib/logger";
import { dbSet, dbGet, dbGetAll, dbDelete } from "./db";

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

export interface LevelConfig {
  enabled: boolean;
  channelId: string | null;
  xpRate: number;
  roleRewards: LevelRoleReward[];
  noXpRoles: string[];
  noXpChannels: string[];
}

const userCache = new Map<string, UserLevel>();
const configCache = new Map<string, LevelConfig>();
const xpCooldown = new Map<string, number>();

const DEFAULT_CONFIG: LevelConfig = {
  enabled: true,
  channelId: null,
  xpRate: 1,
  roleRewards: [],
  noXpRoles: [],
  noXpChannels: [],
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
  while (totalXp >= xpForLevel(level)) {
    totalXp -= xpForLevel(level);
    level++;
  }
  return level;
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
  for (const { key, data } of configRows) configCache.set(key, data);
  logger.info({ users: rows.length, guilds: configRows.length }, "Loaded levels store from DB");
}

export function getLevelConfig(guildId: string): LevelConfig {
  return configCache.get(guildId) ?? { ...DEFAULT_CONFIG };
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

const XP_MIN = 15;
const XP_MAX = 25;
const XP_COOLDOWN_MS = 60_000;

export function tryAddXp(
  guildId: string,
  userId: string,
  config: LevelConfig,
): { leveled: boolean; newLevel: number } | null {
  const cdKey = `${guildId}:${userId}`;
  const last = xpCooldown.get(cdKey) ?? 0;
  if (Date.now() - last < XP_COOLDOWN_MS) return null;
  xpCooldown.set(cdKey, Date.now());

  const gained = Math.floor((Math.random() * (XP_MAX - XP_MIN + 1) + XP_MIN) * config.xpRate);
  const current = getUserLevel(guildId, userId);
  const newXp = current.xp + gained;
  const newLevel = levelFromXp(newXp);
  const leveled = newLevel > current.level;

  setUserLevel(guildId, userId, { xp: newXp, level: newLevel });
  return { leveled, newLevel };
}
