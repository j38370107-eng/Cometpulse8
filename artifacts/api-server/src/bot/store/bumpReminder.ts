import { logger } from "../../lib/logger";
import { dbGet, dbSet, dbGetAll } from "./db";

export const BUMP_CONFIG_STORE = "bumpReminderConfig";
export const BUMP_STATE_STORE = "bumpReminderState";

export interface BumpReminderConfig {
  enabled: boolean;
  channelId: string | null;
  reminderMessage: string;
  roleId: string | null;
  autoDelete: boolean;
}

export interface BumpReminderState {
  lastBumpedAt: number | null;
  lastBumpedBy: string | null;
  reminderMessageId: string | null;
}

const defaultConfig = (): BumpReminderConfig => ({
  enabled: false,
  channelId: null,
  reminderMessage: "⏰ It's been 2 hours! Time to bump the server with `/bump`!",
  roleId: null,
  autoDelete: false,
});

const defaultState = (): BumpReminderState => ({
  lastBumpedAt: null,
  lastBumpedBy: null,
  reminderMessageId: null,
});

const configCache = new Map<string, BumpReminderConfig>();
const stateCache = new Map<string, BumpReminderState>();

export async function initBumpReminderStore(): Promise<void> {
  const configs = await dbGetAll<BumpReminderConfig>(BUMP_CONFIG_STORE);
  for (const { key, data } of configs) {
    configCache.set(key, { ...defaultConfig(), ...data });
  }
  const states = await dbGetAll<BumpReminderState>(BUMP_STATE_STORE);
  for (const { key, data } of states) {
    stateCache.set(key, { ...defaultState(), ...data });
  }
  logger.info("Bump reminder store initialised");
}

export function getBumpReminderConfig(guildId: string): BumpReminderConfig {
  return configCache.get(guildId) ?? defaultConfig();
}

export async function setBumpReminderConfig(guildId: string, config: Partial<BumpReminderConfig>): Promise<void> {
  const updated = { ...getBumpReminderConfig(guildId), ...config };
  configCache.set(guildId, updated);
  await dbSet(BUMP_CONFIG_STORE, guildId, updated);
}

export function getBumpReminderState(guildId: string): BumpReminderState {
  return stateCache.get(guildId) ?? defaultState();
}

export async function setBumpReminderState(guildId: string, state: Partial<BumpReminderState>): Promise<void> {
  const updated = { ...getBumpReminderState(guildId), ...state };
  stateCache.set(guildId, updated);
  await dbSet(BUMP_STATE_STORE, guildId, updated);
}
