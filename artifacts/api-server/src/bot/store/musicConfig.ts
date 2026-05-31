import { dbGet, dbSet } from "./db";

export interface MusicConfig {
  djRole: string;
  musicChannel: string;
  defaultVolume: number;
  maxQueueSize: number;
  autoDisconnectMs: number;
  announceNowPlaying: boolean;
  voteskipPercent: number;
  allowedSources: string[];
}

const defaultConfig = (): MusicConfig => ({
  djRole: "",
  musicChannel: "",
  defaultVolume: 50,
  maxQueueSize: 100,
  autoDisconnectMs: 300_000,
  announceNowPlaying: true,
  voteskipPercent: 50,
  allowedSources: ["youtube", "spotify", "soundcloud"],
});

const configCache = new Map<string, MusicConfig>();

export async function initMusicConfigStore() {}

export async function getMusicConfig(guildId: string): Promise<MusicConfig> {
  if (configCache.has(guildId)) return configCache.get(guildId)!;
  const data = await dbGet<MusicConfig>("musicConfig", guildId);
  const cfg = data ?? defaultConfig();
  configCache.set(guildId, cfg);
  return cfg;
}

export async function setMusicConfig(guildId: string, cfg: MusicConfig): Promise<void> {
  configCache.set(guildId, cfg);
  await dbSet("musicConfig", guildId, cfg);
}

export function reloadMusicConfig(guildId: string) {
  configCache.delete(guildId);
}
