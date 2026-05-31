import { dbGet, dbSet, dbGetAll } from "./db";

export interface EmbedFieldData {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedData {
  title?: string;
  description?: string;
  color?: number;
  authorName?: string;
  authorIconUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  thumbnail?: string;
  image?: string;
  url?: string;
  timestamp?: boolean;
  fields: EmbedFieldData[];
}

export interface EmbedSession {
  userId: string;
  guildId: string;
  channelId: string;
  builderMessageId?: string;
  data: EmbedData;
  editMessageId?: string;
  createdAt: number;
}

export interface EmbedTemplate {
  name: string;
  creatorId: string;
  data: EmbedData;
  createdAt: number;
}

export interface ScheduledEmbed {
  id: string;
  creatorId: string;
  guildId: string;
  channelId: string;
  data: EmbedData;
  sendAt: number;
  webhookName?: string;
  webhookAvatar?: string;
  recurring?: "daily" | "weekly" | "monthly";
}

export interface EmbedBuilderSettings {
  requiredRole?: string;
  allowedChannels: string[];
  maxTemplates: number;
  maxScheduled: number;
  webhookEnabled: boolean;
  variablesEnabled: boolean;
  logChannelId?: string;
}

const TEMPLATE_STORE = "embedTemplates";
const SCHEDULED_STORE = "embedScheduled";
const SETTINGS_STORE = "embedSettings";

export const DEFAULT_EMBED_SETTINGS: EmbedBuilderSettings = {
  allowedChannels: [],
  maxTemplates: 25,
  maxScheduled: 10,
  webhookEnabled: true,
  variablesEnabled: true,
};

// ── In-memory sessions ────────────────────────────────────────────────────────

const sessions = new Map<string, EmbedSession>();
const SESSION_TTL = 30 * 60 * 1000;

export function sessionKey(userId: string, guildId: string): string {
  return `${guildId}:${userId}`;
}

export function getSession(userId: string, guildId: string): EmbedSession | null {
  const key = sessionKey(userId, guildId);
  const s = sessions.get(key);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) { sessions.delete(key); return null; }
  return s;
}

export function setSession(session: EmbedSession): void {
  sessions.set(sessionKey(session.userId, session.guildId), session);
}

export function deleteSession(userId: string, guildId: string): void {
  sessions.delete(sessionKey(userId, guildId));
}

export function createEmptySession(userId: string, guildId: string, channelId: string): EmbedSession {
  return { userId, guildId, channelId, data: { fields: [], color: 0x5865f2 }, createdAt: Date.now() };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions.entries()) {
    if (now - s.createdAt > SESSION_TTL) sessions.delete(key);
  }
}, 10 * 60 * 1000);

// ── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(guildId: string): Promise<Record<string, EmbedTemplate>> {
  return (await dbGet<Record<string, EmbedTemplate>>(TEMPLATE_STORE, guildId)) ?? {};
}

export async function saveTemplate(guildId: string, name: string, tmpl: EmbedTemplate): Promise<void> {
  const all = await getTemplates(guildId);
  all[name.toLowerCase()] = tmpl;
  await dbSet(TEMPLATE_STORE, guildId, all);
}

export async function deleteTemplate(guildId: string, name: string): Promise<boolean> {
  const all = await getTemplates(guildId);
  if (!all[name.toLowerCase()]) return false;
  delete all[name.toLowerCase()];
  await dbSet(TEMPLATE_STORE, guildId, all);
  return true;
}

// ── Scheduled Embeds ─────────────────────────────────────────────────────────

export async function getScheduledEmbeds(guildId: string): Promise<Record<string, ScheduledEmbed>> {
  return (await dbGet<Record<string, ScheduledEmbed>>(SCHEDULED_STORE, guildId)) ?? {};
}

export async function saveScheduledEmbed(guildId: string, embed: ScheduledEmbed): Promise<void> {
  const all = await getScheduledEmbeds(guildId);
  all[embed.id] = embed;
  await dbSet(SCHEDULED_STORE, guildId, all);
}

export async function deleteScheduledEmbed(guildId: string, id: string): Promise<boolean> {
  const all = await getScheduledEmbeds(guildId);
  if (!all[id]) return false;
  delete all[id];
  await dbSet(SCHEDULED_STORE, guildId, all);
  return true;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getEmbedSettings(guildId: string): Promise<EmbedBuilderSettings> {
  return (await dbGet<EmbedBuilderSettings>(SETTINGS_STORE, guildId)) ?? { ...DEFAULT_EMBED_SETTINGS };
}

export async function setEmbedSettings(guildId: string, settings: EmbedBuilderSettings): Promise<void> {
  await dbSet(SETTINGS_STORE, guildId, settings);
}

// ── Scheduler ────────────────────────────────────────────────────────────────

function nextRecurring(ts: number, mode: "daily" | "weekly" | "monthly"): number {
  const d = new Date(ts);
  if (mode === "daily") d.setDate(d.getDate() + 1);
  else if (mode === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

async function runScheduler(client: any): Promise<void> {
  const now = Date.now();
  const allRows = await dbGetAll<Record<string, ScheduledEmbed>>(SCHEDULED_STORE);
  for (const { key: guildId, data: schedMap } of allRows) {
    let changed = false;
    for (const [id, sched] of Object.entries(schedMap)) {
      if (sched.sendAt > now) continue;
      try {
        const guild = client.guilds.cache.get(guildId);
        const ch = guild?.channels.cache.get(sched.channelId);
        if (!ch?.isTextBased()) { delete schedMap[id]; changed = true; continue; }
        const { buildEmbed } = await import("../lib/embedBuilderUtils");
        const embed = buildEmbed(sched.data);
        if (sched.webhookName) {
          const webhooks = await (ch as any).fetchWebhooks?.().catch(() => null);
          let wh = webhooks?.find((w: any) => w.name === "EmbedBuilder");
          if (!wh) wh = await (ch as any).createWebhook?.({ name: "EmbedBuilder" }).catch(() => null);
          if (wh) {
            await wh.send({ embeds: [embed], username: sched.webhookName, avatarURL: sched.webhookAvatar });
          } else {
            await ch.send({ embeds: [embed] });
          }
        } else {
          await (ch as any).send({ embeds: [embed] });
        }
      } catch {}
      if (sched.recurring) {
        schedMap[id] = { ...sched, sendAt: nextRecurring(sched.sendAt, sched.recurring) };
      } else {
        delete schedMap[id];
      }
      changed = true;
    }
    if (changed) await dbSet(SCHEDULED_STORE, guildId, schedMap);
  }
}

export function startEmbedScheduler(client: any): void {
  setInterval(() => runScheduler(client).catch(() => {}), 60_000);
}

export function initEmbedBuilderStore(): void {}
