import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild, User,
} from "discord.js";
import type { EmbedData, EmbedFieldData } from "../store/embedBuilder";

export { EmbedData, EmbedFieldData };

export const BUILDER_CONTENT = "🛠️ **Embed Builder** — Use the buttons below to build your embed. Session expires in 30 min.";

// ── Variable substitution ─────────────────────────────────────────────────────

export function applyVariables(text: string, guild: Guild, user: User): string {
  const now = new Date();
  return text
    .replace(/\{server\}/gi, guild.name)
    .replace(/\{membercount\}/gi, String(guild.memberCount))
    .replace(/\{user\}/gi, `<@${user.id}>`)
    .replace(/\{date\}/gi, now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))
    .replace(/\{time\}/gi, now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
}

// ── Color parsing ─────────────────────────────────────────────────────────────

export function parseColor(input: string): number | null {
  const hex = input.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) return parseInt(hex, 16);
  const named: Record<string, number> = {
    red: 0xe74c3c, blue: 0x3498db, green: 0x2ecc71, yellow: 0xf1c40f,
    orange: 0xe67e22, purple: 0x9b59b6, pink: 0xff69b4, gold: 0xffd700,
    white: 0xffffff, black: 0x010101, grey: 0x95a5a6, gray: 0x95a5a6,
    cyan: 0x1abc9c, teal: 0x1abc9c, navy: 0x2c3e50, blurple: 0x5865f2,
  };
  return named[input.trim().toLowerCase()] ?? null;
}

// ── Build EmbedBuilder from EmbedData ────────────────────────────────────────

export function buildEmbed(data: EmbedData, guild?: Guild, user?: User): EmbedBuilder {
  const embed = new EmbedBuilder();
  const v = (t: string) => (guild && user ? applyVariables(t, guild, user) : t);

  if (data.color !== undefined) embed.setColor(data.color);
  if (data.title) embed.setTitle(v(data.title).slice(0, 256));
  if (data.url) { try { embed.setURL(data.url); } catch {} }
  if (data.description) embed.setDescription(v(data.description).slice(0, 4096));
  if (data.authorName) {
    embed.setAuthor({
      name: v(data.authorName).slice(0, 256),
      iconURL: data.authorIconUrl || undefined,
    });
  }
  if (data.footerText) {
    embed.setFooter({
      text: v(data.footerText).slice(0, 2048),
      iconURL: data.footerIconUrl || undefined,
    });
  }
  if (data.thumbnail) { try { embed.setThumbnail(data.thumbnail); } catch {} }
  if (data.image) { try { embed.setImage(data.image); } catch {} }
  if (data.timestamp) embed.setTimestamp();
  for (const f of data.fields.slice(0, 25)) {
    embed.addFields({
      name: (v(f.name) || "\u200b").slice(0, 256),
      value: (v(f.value) || "\u200b").slice(0, 1024),
      inline: f.inline,
    });
  }
  return embed;
}

export function buildPreviewEmbed(data: EmbedData): EmbedBuilder {
  const embed = buildEmbed(data);
  const isEmpty = !data.title && !data.description && !data.authorName && data.fields.length === 0;
  if (isEmpty) embed.setDescription("*Your embed will appear here. Use the buttons below to start building.*");
  return embed;
}

// ── Convert Discord Embed → EmbedData ────────────────────────────────────────

export function discordEmbedToData(embed: any): EmbedData {
  return {
    title: embed.title ?? undefined,
    description: embed.description ?? undefined,
    color: embed.color ?? undefined,
    url: embed.url ?? undefined,
    authorName: embed.author?.name,
    authorIconUrl: embed.author?.iconURL ?? undefined,
    footerText: embed.footer?.text,
    footerIconUrl: embed.footer?.iconURL ?? undefined,
    thumbnail: embed.thumbnail?.url,
    image: embed.image?.url,
    timestamp: embed.timestamp != null,
    fields: (embed.fields ?? []).map((f: any) => ({
      name: f.name,
      value: f.value,
      inline: f.inline ?? false,
    })),
  };
}

// ── Builder action rows ───────────────────────────────────────────────────────

export function buildBuilderRows(userId: string, fieldCount = 0): ActionRowBuilder<ButtonBuilder>[] {
  const b = (id: string, label: string, style: ButtonStyle) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      b(`eb:title:${userId}`, "Title / URL", ButtonStyle.Secondary),
      b(`eb:desc:${userId}`, "Description", ButtonStyle.Secondary),
      b(`eb:color:${userId}`, "Color", ButtonStyle.Secondary),
      b(`eb:author:${userId}`, "Author", ButtonStyle.Secondary),
      b(`eb:footer:${userId}`, "Footer", ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      b(`eb:thumbnail:${userId}`, "Thumbnail", ButtonStyle.Secondary),
      b(`eb:image:${userId}`, "Image", ButtonStyle.Secondary),
      b(`eb:timestamp:${userId}`, "Timestamp ⏰", ButtonStyle.Secondary),
      b(`eb:addfield:${userId}`, "Add Field ➕", ButtonStyle.Primary),
      b(`eb:fields:${userId}`, `Fields (${fieldCount})`, ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      b(`eb:send:${userId}`, "Send 📤", ButtonStyle.Success),
      b(`eb:save:${userId}`, "Save Template 💾", ButtonStyle.Secondary),
      b(`eb:export:${userId}`, "Export JSON", ButtonStyle.Secondary),
      b(`eb:reset:${userId}`, "Reset 🔄", ButtonStyle.Danger),
      b(`eb:close:${userId}`, "Close ✖", ButtonStyle.Danger),
    ),
  ];
}

// ── Parse relative/absolute time ─────────────────────────────────────────────

export function parseTime(input: string): Date | null {
  const s = input.trim().toLowerCase();
  const now = Date.now();

  const rel = s.match(/^(\d+)\s*(s|sec|m|min|h|hr|d|day|w|week)s?$/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const ms: Record<string, number> = {
      s: 1000, sec: 1000, m: 60000, min: 60000,
      h: 3600000, hr: 3600000, d: 86400000, day: 86400000,
      w: 604800000, week: 604800000,
    };
    return new Date(now + n * (ms[unit] ?? 0));
  }

  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const PRESETS: Record<string, EmbedData> = {
  welcome: {
    title: "👋 Welcome to {server}!",
    description: "We're glad to have you here, {user}!\nWe now have **{membercount}** members.\n\nPlease read the rules and enjoy your stay!",
    color: 0x5865f2, footerText: "{server} • {date}", timestamp: true,
    fields: [
      { name: "📋 Rules", value: "Read them before chatting!", inline: true },
      { name: "🎭 Roles", value: "Grab your roles in #roles!", inline: true },
    ],
  },
  rules: {
    title: "📜 Server Rules",
    description: "Please follow these rules to keep {server} a great place for everyone!",
    color: 0xe74c3c, footerText: "Breaking rules may result in a mute, kick, or ban.",
    fields: [
      { name: "1. Be Respectful", value: "Treat all members with respect. No harassment or hate speech.", inline: false },
      { name: "2. No Spam", value: "Do not spam messages, links, or mentions.", inline: false },
      { name: "3. No NSFW", value: "Keep all content safe for work.", inline: false },
      { name: "4. Follow Discord TOS", value: "https://discord.com/terms", inline: false },
    ],
  },
  announcement: {
    title: "📣 Announcement",
    description: "Type your announcement content here...",
    color: 0xf1c40f, footerText: "{server} • {date}", timestamp: true, fields: [],
  },
  info: {
    title: "ℹ️ About {server}",
    description: "Welcome to {server}! Here's some info about our community.",
    color: 0x2ecc71, footerText: "{membercount} members", timestamp: true,
    fields: [
      { name: "📅 Founded", value: "Fill in your date", inline: true },
      { name: "🌐 Website", value: "Your website here", inline: true },
    ],
  },
  giveaway: {
    title: "🎉 GIVEAWAY",
    description: "**Prize:** Enter prize here\n\n**How to enter:** React with 🎉 below!\n\n**Ends:** Enter end time",
    color: 0xffd700, footerText: "Ends at", timestamp: true,
    fields: [
      { name: "Winners", value: "1", inline: true },
      { name: "Hosted by", value: "{user}", inline: true },
    ],
  },
  poll: {
    title: "📊 Poll",
    description: "**Question:** Type your question here\n\n🇦 Option 1\n🇧 Option 2\n🇨 Option 3",
    color: 0x3498db, footerText: "Vote by reacting!", timestamp: true, fields: [],
  },
};

// ── JSON ↔ EmbedData ─────────────────────────────────────────────────────────

export function embedDataToDiscohookJson(data: EmbedData): object {
  const embed: any = {};
  if (data.title) embed.title = data.title;
  if (data.description) embed.description = data.description;
  if (data.color !== undefined) embed.color = data.color;
  if (data.url) embed.url = data.url;
  if (data.authorName) embed.author = { name: data.authorName, icon_url: data.authorIconUrl };
  if (data.footerText) embed.footer = { text: data.footerText, icon_url: data.footerIconUrl };
  if (data.thumbnail) embed.thumbnail = { url: data.thumbnail };
  if (data.image) embed.image = { url: data.image };
  if (data.timestamp) embed.timestamp = new Date().toISOString();
  if (data.fields.length) embed.fields = data.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline }));
  return { embeds: [embed] };
}

export function discohookJsonToEmbedData(json: any): EmbedData | null {
  try {
    const raw = json.embeds?.[0] ?? json;
    return {
      title: raw.title,
      description: raw.description,
      color: raw.color,
      url: raw.url,
      authorName: raw.author?.name,
      authorIconUrl: raw.author?.icon_url,
      footerText: raw.footer?.text,
      footerIconUrl: raw.footer?.icon_url,
      thumbnail: raw.thumbnail?.url,
      image: raw.image?.url,
      timestamp: raw.timestamp != null,
      fields: (raw.fields ?? []).map((f: any) => ({ name: f.name, value: f.value, inline: f.inline ?? false })),
    };
  } catch {
    return null;
  }
}
