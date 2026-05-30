import { dbGet, dbSet } from "./db";
import { logger } from "../../lib/logger";

const STORE = "timedRoles";

export interface TimedRoleEntry {
  userId: string;
  roleId: string;
  expiresAt: number;
  panelId: string;
}

// guildId → TimedRoleEntry[]
const cache = new Map<string, TimedRoleEntry[]>();

export async function initTimedRolesStore(): Promise<void> {
  // Loaded lazily per guild — no bulk init needed
}

export async function addTimedRole(guildId: string, entry: TimedRoleEntry): Promise<void> {
  if (!cache.has(guildId)) {
    const stored = (await dbGet<TimedRoleEntry[]>(STORE, guildId)) ?? [];
    cache.set(guildId, stored);
  }
  const list = cache.get(guildId)!;
  // Remove any existing entry for same user+role
  const filtered = list.filter((e) => !(e.userId === entry.userId && e.roleId === entry.roleId));
  filtered.push(entry);
  cache.set(guildId, filtered);
  await dbSet(STORE, guildId, filtered);
}

export async function removeTimedRole(guildId: string, userId: string, roleId: string): Promise<void> {
  const list = cache.get(guildId) ?? [];
  const filtered = list.filter((e) => !(e.userId === userId && e.roleId === roleId));
  cache.set(guildId, filtered);
  await dbSet(STORE, guildId, filtered);
}

export function getExpiredRoles(guildId: string): TimedRoleEntry[] {
  const now = Date.now();
  return (cache.get(guildId) ?? []).filter((e) => e.expiresAt <= now);
}

export function startTimedRoleExpiry(client: import("discord.js").Client): void {
  setInterval(async () => {
    for (const [guildId, entries] of cache) {
      const expired = entries.filter((e) => e.expiresAt <= Date.now());
      if (expired.length === 0) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      for (const entry of expired) {
        try {
          const member = await guild.members.fetch(entry.userId).catch(() => null);
          if (member) {
            await member.roles.remove(entry.roleId, "Timed role expired").catch(() => {});
          }
          await removeTimedRole(guildId, entry.userId, entry.roleId);
        } catch (err) {
          logger.error({ err, guildId, userId: entry.userId, roleId: entry.roleId }, "Failed to remove timed role");
        }
      }
    }
  }, 60_000);
}
