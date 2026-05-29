import { logger } from "../../lib/logger";
import { dbSet, dbDelete, dbGetAll } from "./db";

const STORE = "tickets";

export interface TicketGuildConfig {
  categoryId?: string;
  logChannelId?: string;
  pingRoleId?: string;
  supportRoleId?: string;
  panelChannelId?: string;
  blacklist: string[];
  openMessage?: string;
}

export interface ActiveTicket {
  channelId: string;
  userId: string;
  userTag: string;
  claimedBy?: string;
  claimedByTag?: string;
  createdAt: number;
  closed: boolean;
}

interface TicketStoreData {
  guilds: Record<string, TicketGuildConfig>;
  tickets: Record<string, ActiveTicket>;
  counter: Record<string, number>;
}

const SINGLETON_KEY = "__tickets__";
let cache: TicketStoreData = { guilds: {}, tickets: {}, counter: {} };

export async function initTicketsStore(): Promise<void> {
  const rows = await dbGetAll<TicketStoreData>(STORE);
  for (const { data } of rows) {
    cache = data;
  }
  logger.info("Loaded tickets store from DB");
}

function save(): void {
  dbSet(STORE, SINGLETON_KEY, cache).catch((err) =>
    logger.error({ err }, "Failed to save tickets")
  );
}

export function getTicketConfig(guildId: string): TicketGuildConfig {
  return cache.guilds[guildId] ?? { blacklist: [] };
}

export function resetTicketConfig(guildId: string): void {
  cache.guilds[guildId] = { blacklist: [] };
  save();
}

export function updateTicketConfig(guildId: string, partial: Partial<TicketGuildConfig>): void {
  cache.guilds[guildId] = { ...getTicketConfig(guildId), ...partial };
  save();
}

export function blacklistUser(guildId: string, userId: string): void {
  const cfg = getTicketConfig(guildId);
  if (!cfg.blacklist.includes(userId)) {
    cfg.blacklist.push(userId);
    cache.guilds[guildId] = cfg;
    save();
  }
}

export function unblacklistUser(guildId: string, userId: string): boolean {
  const cfg = getTicketConfig(guildId);
  const idx = cfg.blacklist.indexOf(userId);
  if (idx === -1) return false;
  cfg.blacklist.splice(idx, 1);
  cache.guilds[guildId] = cfg;
  save();
  return true;
}

export function isBlacklisted(guildId: string, userId: string): boolean {
  return getTicketConfig(guildId).blacklist.includes(userId);
}

export function nextTicketNumber(guildId: string): number {
  cache.counter[guildId] = (cache.counter[guildId] ?? 0) + 1;
  save();
  return cache.counter[guildId]!;
}

export function openTicket(ticket: ActiveTicket): void {
  cache.tickets[ticket.channelId] = ticket;
  save();
}

export function getTicket(channelId: string): ActiveTicket | null {
  return cache.tickets[channelId] ?? null;
}

export function updateTicket(channelId: string, partial: Partial<ActiveTicket>): void {
  if (!cache.tickets[channelId]) return;
  cache.tickets[channelId] = { ...cache.tickets[channelId]!, ...partial };
  save();
}

export function closeTicketRecord(channelId: string): void {
  if (cache.tickets[channelId]) {
    cache.tickets[channelId]!.closed = true;
    save();
  }
}

export function deleteTicketRecord(channelId: string): void {
  delete cache.tickets[channelId];
  save();
}

export function getUserOpenTicket(guildId: string, userId: string): ActiveTicket | null {
  return Object.values(cache.tickets).find((t) => t.userId === userId && !t.closed) ?? null;
}
