import { logger } from "../../lib/logger";
import { dbGet, dbSet, dbDelete, dbGetAll } from "./db";

export const COUNTING_CONFIG_STORE = "countingConfig";
export const COUNTING_STATE_STORE = "countingState";
export const COUNTING_STATS_STORE = "countingStats";

export type CountingMode = "normal" | "math" | "roman" | "binary" | "hex" | "letters";
export type FailPunishment = "timeout" | "warn" | "nothing";

export interface CountingConfig {
  channelId: string | null;
  mode: CountingMode;
  resetOnFail: boolean;
  deleteWrong: boolean;
  milestoneInterval: number;
  milestoneRoleId: string | null;
  milestoneEmoji: string;
  failPunishment: FailPunishment;
  reactEmoji: string;
  updateTopic: boolean;
  noSameUserTwice: boolean;
  checkpointInterval: number;
}

export interface CountingState {
  currentCount: number;
  highScore: number;
  lastUserId: string | null;
  lastMessageId: string | null;
  lastCheckpoint: number;
  totalFails: number;
  lastFailUserId: string | null;
}

export interface CountingUserStats {
  userId: string;
  contributions: number;
  fails: number;
}

const defaultConfig = (): CountingConfig => ({
  channelId: null,
  mode: "normal",
  resetOnFail: true,
  deleteWrong: true,
  milestoneInterval: 100,
  milestoneRoleId: null,
  milestoneEmoji: "🎉",
  failPunishment: "nothing",
  reactEmoji: "✅",
  updateTopic: true,
  noSameUserTwice: true,
  checkpointInterval: 0,
});

const defaultState = (): CountingState => ({
  currentCount: 0,
  highScore: 0,
  lastUserId: null,
  lastMessageId: null,
  lastCheckpoint: 0,
  totalFails: 0,
  lastFailUserId: null,
});

const configCache = new Map<string, CountingConfig>();
const stateCache = new Map<string, CountingState>();
const statsCache = new Map<string, Map<string, CountingUserStats>>();

export async function initCountingStore(): Promise<void> {
  const configs = await dbGetAll<CountingConfig>(COUNTING_CONFIG_STORE);
  for (const { key, data } of configs) {
    configCache.set(key, { ...defaultConfig(), ...data });
  }
  const states = await dbGetAll<CountingState>(COUNTING_STATE_STORE);
  for (const { key, data } of states) {
    stateCache.set(key, { ...defaultState(), ...data });
  }
  const stats = await dbGetAll<CountingUserStats[]>(COUNTING_STATS_STORE);
  for (const { key, data } of stats) {
    const map = new Map<string, CountingUserStats>();
    if (Array.isArray(data)) {
      for (const s of data) map.set(s.userId, s);
    }
    statsCache.set(key, map);
  }
  logger.info("Counting store initialised");
}

export function getCountingConfig(guildId: string): CountingConfig {
  return configCache.get(guildId) ?? defaultConfig();
}

export async function setCountingConfig(guildId: string, config: Partial<CountingConfig>): Promise<void> {
  const current = getCountingConfig(guildId);
  const updated = { ...current, ...config };
  configCache.set(guildId, updated);
  await dbSet(COUNTING_CONFIG_STORE, guildId, updated);
}

export function getCountingState(guildId: string): CountingState {
  return stateCache.get(guildId) ?? defaultState();
}

export async function setCountingState(guildId: string, state: Partial<CountingState>): Promise<void> {
  const current = getCountingState(guildId);
  const updated = { ...current, ...state };
  stateCache.set(guildId, updated);
  await dbSet(COUNTING_STATE_STORE, guildId, updated);
}

export function getCountingStats(guildId: string): Map<string, CountingUserStats> {
  if (!statsCache.has(guildId)) statsCache.set(guildId, new Map());
  return statsCache.get(guildId)!;
}

export async function addCountingContribution(guildId: string, userId: string): Promise<void> {
  const map = getCountingStats(guildId);
  const current = map.get(userId) ?? { userId, contributions: 0, fails: 0 };
  current.contributions += 1;
  map.set(userId, current);
  await dbSet(COUNTING_STATS_STORE, guildId, Array.from(map.values()));
}

export async function addCountingFail(guildId: string, userId: string): Promise<void> {
  const map = getCountingStats(guildId);
  const current = map.get(userId) ?? { userId, contributions: 0, fails: 0 };
  current.fails += 1;
  map.set(userId, current);
  await dbSet(COUNTING_STATS_STORE, guildId, Array.from(map.values()));
}

export async function resetCountingStats(guildId: string): Promise<void> {
  statsCache.set(guildId, new Map());
  await dbDelete(COUNTING_STATS_STORE, guildId);
}
