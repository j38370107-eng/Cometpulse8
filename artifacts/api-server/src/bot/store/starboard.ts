import { dbGet, dbSet } from "./db";

export interface StarboardConfig {
  enabled: boolean;
  channelId: string;
  emoji: string;
  threshold: number;
  selfStar: boolean;
  ignoreBots: boolean;
  ignoreNsfw: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  locked: boolean;
  maxAgeDays: number;
  nsfwChannelId: string;
}

export interface StarboardEntry {
  originalMessageId: string;
  originalChannelId: string;
  authorId: string;
  starboardMessageId: string;
  starCount: number;
  postedAt: number;
}

const defaultConfig = (): StarboardConfig => ({
  enabled: false,
  channelId: "",
  emoji: "⭐",
  threshold: 3,
  selfStar: false,
  ignoreBots: true,
  ignoreNsfw: false,
  ignoredChannels: [],
  ignoredRoles: [],
  locked: false,
  maxAgeDays: 30,
  nsfwChannelId: "",
});

const configCache = new Map<string, StarboardConfig>();
const entriesCache = new Map<string, Record<string, StarboardEntry>>();

export async function initStarboardStore() {}

export async function getStarboardConfig(guildId: string): Promise<StarboardConfig> {
  if (configCache.has(guildId)) return configCache.get(guildId)!;
  const data = await dbGet<StarboardConfig>("starboardConfig", guildId);
  const cfg = data ?? defaultConfig();
  configCache.set(guildId, cfg);
  return cfg;
}

export async function setStarboardConfig(guildId: string, cfg: StarboardConfig): Promise<void> {
  configCache.set(guildId, cfg);
  await dbSet("starboardConfig", guildId, cfg);
}

async function loadEntries(guildId: string): Promise<Record<string, StarboardEntry>> {
  if (entriesCache.has(guildId)) return entriesCache.get(guildId)!;
  const data = await dbGet<Record<string, StarboardEntry>>("starboardEntries", guildId);
  const entries = data ?? {};
  entriesCache.set(guildId, entries);
  return entries;
}

async function saveEntries(guildId: string, entries: Record<string, StarboardEntry>): Promise<void> {
  entriesCache.set(guildId, entries);
  await dbSet("starboardEntries", guildId, entries);
}

export async function getStarboardEntry(guildId: string, originalMessageId: string): Promise<StarboardEntry | null> {
  const entries = await loadEntries(guildId);
  return entries[originalMessageId] ?? null;
}

export async function setStarboardEntry(guildId: string, originalMessageId: string, entry: StarboardEntry): Promise<void> {
  const entries = await loadEntries(guildId);
  entries[originalMessageId] = entry;
  await saveEntries(guildId, entries);
}

export async function deleteStarboardEntry(guildId: string, originalMessageId: string): Promise<void> {
  const entries = await loadEntries(guildId);
  delete entries[originalMessageId];
  await saveEntries(guildId, entries);
}

export async function getAllStarboardEntries(guildId: string): Promise<StarboardEntry[]> {
  const entries = await loadEntries(guildId);
  return Object.values(entries);
}

export function reloadStarboardConfig(guildId: string) {
  configCache.delete(guildId);
}

export function getStarLevel(count: number): string {
  if (count >= 50) return "🌠";
  if (count >= 25) return "💫";
  if (count >= 10) return "🌟";
  return "⭐";
}
