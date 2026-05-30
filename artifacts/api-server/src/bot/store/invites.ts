import { logger } from "../../lib/logger";
import { dbSet, dbGetAll } from "./db";

const STORE = "invites";

export interface InviteRecord {
  inviterId: string;
  inviterTag: string;
  count: number;
  fakeCount: number;
  invitedUsers: string[];
}

export type InviteCache = Map<
  string,
  Map<string, { uses: number; inviterId: string; inviterTag: string }>
>;

export const inviteCache: InviteCache = new Map();

type GuildInvites = Record<string, InviteRecord>;
const cache = new Map<string, GuildInvites>();

export async function initInvitesStore(): Promise<void> {
  const rows = await dbGetAll<GuildInvites>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded invites store from DB");
}

function save(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId) ?? {}).catch((err) =>
    logger.error({ err }, "Failed to save invites")
  );
}

export function recordInvite(
  guildId: string,
  inviterId: string,
  inviterTag: string,
  invitedUserId: string,
): void {
  if (!cache.has(guildId)) cache.set(guildId, {});
  const guild = cache.get(guildId)!;
  if (!guild[inviterId]) {
    guild[inviterId] = { inviterId, inviterTag, count: 0, fakeCount: 0, invitedUsers: [] };
  }
  const record = guild[inviterId]!;
  record.count++;
  record.inviterTag = inviterTag;
  if (!record.invitedUsers.includes(invitedUserId)) {
    record.invitedUsers.push(invitedUserId);
  }
  save(guildId);
}

export function getInviterForUser(guildId: string, userId: string): InviteRecord | null {
  const guild = cache.get(guildId);
  if (!guild) return null;
  return Object.values(guild).find((r) => r.invitedUsers.includes(userId)) ?? null;
}

export function markFakeLeave(guildId: string, userId: string): void {
  const guild = cache.get(guildId);
  if (!guild) return;
  const record = Object.values(guild).find((r) => r.invitedUsers.includes(userId));
  if (!record) return;
  record.fakeCount = (record.fakeCount ?? 0) + 1;
  save(guildId);
}

export function getInviteStats(guildId: string, inviterId: string): InviteRecord | null {
  return cache.get(guildId)?.[inviterId] ?? null;
}

export function getInviteLeaderboard(guildId: string): InviteRecord[] {
  return Object.values(cache.get(guildId) ?? {}).sort((a, b) => b.count - a.count);
}
