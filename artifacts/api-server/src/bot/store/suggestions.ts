import { dbGet, dbSet } from "./db";

export interface SuggestionConfig {
  enabled: boolean;
  channelId: string;
  staffRole: string;
  cooldownMs: number;
  maxPerUser: number;
  locked: boolean;
  dmNotify: boolean;
  threadCreation: boolean;
  anonymousEnabled: boolean;
  requiredRole: string;
  blacklistedUsers: string[];
}

export type SuggestionStatus = "pending" | "approved" | "denied" | "implemented" | "duplicate" | "under_review";

export interface Suggestion {
  id: number;
  guildId: string;
  authorId: string;
  content: string;
  status: SuggestionStatus;
  upvotes: string[];
  downvotes: string[];
  messageId: string;
  channelId: string;
  staffResponse: string;
  reviewerId: string;
  createdAt: number;
}

const defaultConfig = (): SuggestionConfig => ({
  enabled: false,
  channelId: "",
  staffRole: "",
  cooldownMs: 3_600_000,
  maxPerUser: 3,
  locked: false,
  dmNotify: true,
  threadCreation: true,
  anonymousEnabled: false,
  requiredRole: "",
  blacklistedUsers: [],
});

const configCache = new Map<string, SuggestionConfig>();
const suggestionsCache = new Map<string, Suggestion[]>();
const cooldownCache = new Map<string, number>();

export async function initSuggestionsStore() {}

export async function getSuggestionConfig(guildId: string): Promise<SuggestionConfig> {
  if (configCache.has(guildId)) return configCache.get(guildId)!;
  const data = await dbGet<SuggestionConfig>("suggestionConfig", guildId);
  const cfg = data ?? defaultConfig();
  configCache.set(guildId, cfg);
  return cfg;
}

export async function setSuggestionConfig(guildId: string, cfg: SuggestionConfig): Promise<void> {
  configCache.set(guildId, cfg);
  await dbSet("suggestionConfig", guildId, cfg);
}

async function loadSuggestions(guildId: string): Promise<Suggestion[]> {
  if (suggestionsCache.has(guildId)) return suggestionsCache.get(guildId)!;
  const data = await dbGet<Suggestion[]>("suggestions", guildId);
  const list = data ?? [];
  suggestionsCache.set(guildId, list);
  return list;
}

async function saveSuggestions(guildId: string, list: Suggestion[]): Promise<void> {
  suggestionsCache.set(guildId, list);
  await dbSet("suggestions", guildId, list);
}

export async function addSuggestion(guildId: string, suggestion: Omit<Suggestion, "id">): Promise<Suggestion> {
  const list = await loadSuggestions(guildId);
  const id = list.length > 0 ? Math.max(...list.map(s => s.id)) + 1 : 1;
  const full: Suggestion = { ...suggestion, id };
  list.push(full);
  await saveSuggestions(guildId, list);
  return full;
}

export async function getSuggestion(guildId: string, id: number): Promise<Suggestion | null> {
  const list = await loadSuggestions(guildId);
  return list.find(s => s.id === id) ?? null;
}

export async function getSuggestionByMessageId(guildId: string, messageId: string): Promise<Suggestion | null> {
  const list = await loadSuggestions(guildId);
  return list.find(s => s.messageId === messageId) ?? null;
}

export async function updateSuggestion(guildId: string, id: number, patch: Partial<Suggestion>): Promise<void> {
  const list = await loadSuggestions(guildId);
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch };
  await saveSuggestions(guildId, list);
}

export async function deleteSuggestion(guildId: string, id: number): Promise<void> {
  const list = await loadSuggestions(guildId);
  await saveSuggestions(guildId, list.filter(s => s.id !== id));
}

export async function getGuildSuggestions(guildId: string): Promise<Suggestion[]> {
  return loadSuggestions(guildId);
}

export function getSuggestionCooldown(guildId: string, userId: string): number {
  return cooldownCache.get(`${guildId}:${userId}`) ?? 0;
}

export function setSuggestionCooldown(guildId: string, userId: string, ts: number): void {
  cooldownCache.set(`${guildId}:${userId}`, ts);
}

export function reloadSuggestionConfig(guildId: string) {
  configCache.delete(guildId);
}

export function countUserOpenSuggestions(suggestions: Suggestion[], userId: string): number {
  return suggestions.filter(s => s.authorId === userId && s.status === "pending").length;
}
