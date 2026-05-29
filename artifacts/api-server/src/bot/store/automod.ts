import { logger } from "../../lib/logger";
import { dbSet, dbGetAll } from "./db";

const STORE = "automod";

export type AutomodAction = "warn" | "mute" | "kick" | "ban";

export interface PunishmentStep {
  strikes: number;
  action: AutomodAction;
  duration?: string;
}

export interface AutomodConfig {
  filter:       { enabled: boolean; words: string[]; wildcardWords: string[] };
  invite:       { enabled: boolean };
  mention:      { enabled: boolean; threshold: number };
  spam:         { enabled: boolean; limit: number; windowMs: number };
  duplicate:    { enabled: boolean; count: number };
  charFlood:    { enabled: boolean; maxRepeat: number; maxEmoji: number };
  linkSpam:     { enabled: boolean; limit: number; windowMs: number };
  urlFilter:    { enabled: boolean; mode: "whitelist" | "blacklist"; domains: string[] };
  wallText:     { enabled: boolean; maxLength: number; maxLines: number };
  channelModuleExempts: Record<string, EnableableModule[]>;
  exemptRoles:    string[];
  exemptChannels: string[];
  punishment:   { steps: PunishmentStep[] };
  /** When true, AutoMod will not post any warning notice in the server channel — only DM the user. */
  silent: boolean;
}

export type EnableableModule =
  | "filter" | "invite" | "mention" | "spam" | "duplicate"
  | "charFlood" | "linkSpam" | "urlFilter" | "wallText";

const DEFAULT_CONFIG: AutomodConfig = {
  filter:       { enabled: false, words: [], wildcardWords: [] },
  invite:       { enabled: false },
  mention:      { enabled: false, threshold: 5 },
  spam:         { enabled: false, limit: 5, windowMs: 5000 },
  duplicate:    { enabled: false, count: 3 },
  charFlood:    { enabled: false, maxRepeat: 10, maxEmoji: 10 },
  linkSpam:     { enabled: false, limit: 5, windowMs: 10_000 },
  urlFilter:    { enabled: false, mode: "blacklist", domains: [] },
  wallText:     { enabled: false, maxLength: 500, maxLines: 15 },
  channelModuleExempts: {},
  exemptRoles:    [],
  exemptChannels: [],
  punishment:   { steps: [] },
  silent:       false,
};

const cache = new Map<string, AutomodConfig>();

export async function initAutomodStore(): Promise<void> {
  const rows = await dbGetAll<AutomodConfig>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded automod store from DB");
}

function getConfig(guildId: string): AutomodConfig {
  if (!cache.has(guildId)) {
    const cfg: AutomodConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cache.set(guildId, cfg);
    dbSet(STORE, guildId, cfg).catch((err) =>
      logger.error({ err }, "Failed to save default automod config")
    );
  }
  const cfg = cache.get(guildId)!;
  cfg.filter        ??= { ...DEFAULT_CONFIG.filter };
  cfg.filter.wildcardWords ??= [];
  cfg.invite        ??= { ...DEFAULT_CONFIG.invite };
  cfg.mention       ??= { ...DEFAULT_CONFIG.mention };
  cfg.spam          ??= { ...DEFAULT_CONFIG.spam };
  cfg.duplicate     ??= { ...DEFAULT_CONFIG.duplicate };
  cfg.charFlood     ??= { ...DEFAULT_CONFIG.charFlood };
  cfg.linkSpam      ??= { ...DEFAULT_CONFIG.linkSpam };
  cfg.urlFilter     ??= { ...DEFAULT_CONFIG.urlFilter, domains: [] };
  cfg.wallText             ??= { ...DEFAULT_CONFIG.wallText };
  cfg.channelModuleExempts ??= {};
  cfg.exemptRoles          ??= [];
  cfg.exemptChannels ??= [];
  cfg.punishment    ??= { steps: [] };
  cfg.silent        ??= false;
  return cfg;
}

function persistConfig(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId)!).catch((err) =>
    logger.error({ err }, "Failed to save automod config")
  );
}

export function getAutomodConfig(guildId: string): AutomodConfig {
  return getConfig(guildId);
}

export function setModuleEnabled(guildId: string, module: EnableableModule, enabled: boolean): void {
  (getConfig(guildId)[module] as { enabled: boolean }).enabled = enabled;
  persistConfig(guildId);
}

// ── Word filter ──────────────────────────────────────────────────────────────

export function addFilterWord(guildId: string, word: string): void {
  const cfg = getConfig(guildId);
  const w = word.toLowerCase();
  if (!cfg.filter.words.includes(w)) cfg.filter.words.push(w);
  persistConfig(guildId);
}

export function removeFilterWord(guildId: string, word: string): boolean {
  const cfg = getConfig(guildId);
  const w = word.toLowerCase();
  const idx = cfg.filter.words.indexOf(w);
  if (idx === -1) return false;
  cfg.filter.words.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

export function addWildcardFilterWord(guildId: string, word: string): void {
  const cfg = getConfig(guildId);
  const w = word.toLowerCase();
  cfg.filter.wildcardWords ??= [];
  if (!cfg.filter.wildcardWords.includes(w)) cfg.filter.wildcardWords.push(w);
  persistConfig(guildId);
}

export function removeWildcardFilterWord(guildId: string, word: string): boolean {
  const cfg = getConfig(guildId);
  cfg.filter.wildcardWords ??= [];
  const w = word.toLowerCase();
  const idx = cfg.filter.wildcardWords.indexOf(w);
  if (idx === -1) return false;
  cfg.filter.wildcardWords.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

// ── Mention ──────────────────────────────────────────────────────────────────

export function setMentionThreshold(guildId: string, threshold: number): void {
  getConfig(guildId).mention.threshold = threshold;
  persistConfig(guildId);
}

// ── Spam ─────────────────────────────────────────────────────────────────────

export function setSpamConfig(guildId: string, limit: number, windowMs: number): void {
  const cfg = getConfig(guildId);
  cfg.spam.limit = limit;
  cfg.spam.windowMs = windowMs;
  persistConfig(guildId);
}

// ── Duplicate ────────────────────────────────────────────────────────────────

export function setDuplicateCount(guildId: string, count: number): void {
  getConfig(guildId).duplicate.count = count;
  persistConfig(guildId);
}

// ── Char flood ───────────────────────────────────────────────────────────────

export function setCharFloodConfig(guildId: string, maxRepeat: number, maxEmoji: number): void {
  const cfg = getConfig(guildId);
  cfg.charFlood.maxRepeat = maxRepeat;
  cfg.charFlood.maxEmoji  = maxEmoji;
  persistConfig(guildId);
}

// ── Wall text ────────────────────────────────────────────────────────────────

export function setWallTextConfig(guildId: string, maxLength: number, maxLines: number): void {
  const cfg = getConfig(guildId);
  cfg.wallText.maxLength = maxLength;
  cfg.wallText.maxLines  = maxLines;
  persistConfig(guildId);
}

// ── Link spam ────────────────────────────────────────────────────────────────

export function setLinkSpamConfig(guildId: string, limit: number, windowMs: number): void {
  const cfg = getConfig(guildId);
  cfg.linkSpam.limit    = limit;
  cfg.linkSpam.windowMs = windowMs;
  persistConfig(guildId);
}

// ── URL filter ───────────────────────────────────────────────────────────────

export function setUrlFilterMode(guildId: string, mode: "whitelist" | "blacklist"): void {
  getConfig(guildId).urlFilter.mode = mode;
  persistConfig(guildId);
}

export function addUrlDomain(guildId: string, domain: string): boolean {
  const cfg = getConfig(guildId);
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (cfg.urlFilter.domains.includes(d)) return false;
  cfg.urlFilter.domains.push(d);
  persistConfig(guildId);
  return true;
}

export function removeUrlDomain(guildId: string, domain: string): boolean {
  const cfg = getConfig(guildId);
  const d = domain.toLowerCase().replace(/^www\./, "");
  const idx = cfg.urlFilter.domains.indexOf(d);
  if (idx === -1) return false;
  cfg.urlFilter.domains.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

// ── Per-channel module exemptions ────────────────────────────────────────────

export function addChannelModuleExempt(guildId: string, channelId: string, module: EnableableModule): boolean {
  const cfg = getConfig(guildId);
  cfg.channelModuleExempts[channelId] ??= [];
  if (cfg.channelModuleExempts[channelId].includes(module)) return false;
  cfg.channelModuleExempts[channelId].push(module);
  persistConfig(guildId);
  return true;
}

export function removeChannelModuleExempt(guildId: string, channelId: string, module: EnableableModule): boolean {
  const cfg = getConfig(guildId);
  const list = cfg.channelModuleExempts[channelId];
  if (!list) return false;
  const idx = list.indexOf(module);
  if (idx === -1) return false;
  list.splice(idx, 1);
  if (list.length === 0) delete cfg.channelModuleExempts[channelId];
  persistConfig(guildId);
  return true;
}

export function getChannelModuleExempts(guildId: string): Record<string, EnableableModule[]> {
  return getConfig(guildId).channelModuleExempts;
}

// ── Exempt roles ─────────────────────────────────────────────────────────────

export function addExemptRole(guildId: string, roleId: string): boolean {
  const cfg = getConfig(guildId);
  if (cfg.exemptRoles.includes(roleId)) return false;
  cfg.exemptRoles.push(roleId);
  persistConfig(guildId);
  return true;
}

export function removeExemptRole(guildId: string, roleId: string): boolean {
  const cfg = getConfig(guildId);
  const idx = cfg.exemptRoles.indexOf(roleId);
  if (idx === -1) return false;
  cfg.exemptRoles.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

// ── Exempt channels ──────────────────────────────────────────────────────────

export function addExemptChannel(guildId: string, channelId: string): boolean {
  const cfg = getConfig(guildId);
  if (cfg.exemptChannels.includes(channelId)) return false;
  cfg.exemptChannels.push(channelId);
  persistConfig(guildId);
  return true;
}

export function removeExemptChannel(guildId: string, channelId: string): boolean {
  const cfg = getConfig(guildId);
  const idx = cfg.exemptChannels.indexOf(channelId);
  if (idx === -1) return false;
  cfg.exemptChannels.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

// ── Silent mode ──────────────────────────────────────────────────────────────

export function setSilentMode(guildId: string, enabled: boolean): void {
  getConfig(guildId).silent = enabled;
  persistConfig(guildId);
}

// ── Punishment steps ─────────────────────────────────────────────────────────

export function setPunishmentStep(guildId: string, step: PunishmentStep): void {
  const cfg = getConfig(guildId);
  const existing = cfg.punishment.steps.findIndex((s) => s.strikes === step.strikes);
  if (existing !== -1) cfg.punishment.steps[existing] = step;
  else cfg.punishment.steps.push(step);
  cfg.punishment.steps.sort((a, b) => a.strikes - b.strikes);
  persistConfig(guildId);
}

export function removePunishmentStep(guildId: string, strikes: number): boolean {
  const cfg = getConfig(guildId);
  const idx = cfg.punishment.steps.findIndex((s) => s.strikes === strikes);
  if (idx === -1) return false;
  cfg.punishment.steps.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

export function resetPunishmentSteps(guildId: string): void {
  getConfig(guildId).punishment.steps = JSON.parse(
    JSON.stringify(DEFAULT_CONFIG.punishment.steps)
  );
  persistConfig(guildId);
}

// ── In-memory strike tracking ────────────────────────────────────────────────

const strikes = new Map<string, number>();

function strikeKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export function incrementStrikes(guildId: string, userId: string): number {
  const key = strikeKey(guildId, userId);
  const count = (strikes.get(key) ?? 0) + 1;
  strikes.set(key, count);
  return count;
}

export function getStrikes(guildId: string, userId: string): number {
  return strikes.get(strikeKey(guildId, userId)) ?? 0;
}

export function clearStrikes(guildId: string, userId: string): void {
  strikes.delete(strikeKey(guildId, userId));
}

export function getPunishmentForStrikes(guildId: string, strikeCount: number): PunishmentStep | null {
  return getConfig(guildId).punishment.steps.find((s) => s.strikes === strikeCount) ?? null;
}

export function setAutomodConfig(guildId: string, cfg: AutomodConfig): void {
  cache.set(guildId, JSON.parse(JSON.stringify(cfg)));
  persistConfig(guildId);
}

export function resetAutomodConfig(guildId: string): void {
  const fresh: AutomodConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  cache.set(guildId, fresh);
  dbSet(STORE, guildId, fresh).catch((err) => logger.error({ err }, "Failed to reset automod config"));
}

export function getAutomodConfig_raw(guildId: string): AutomodConfig | undefined {
  return cache.get(guildId);
}
