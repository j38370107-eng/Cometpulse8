import { Router } from "express";
import { dbGet, dbSet } from "../db.js";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireGuildAccess(req: any, res: any, next: any) {
  const { guildId } = req.params;
  const guilds: any[] = req.session.guilds ?? [];
  if (!guilds.find((g: any) => g.id === guildId)) {
    return res.status(403).json({ error: "Access denied to this server" });
  }
  next();
}

const auth = [requireAuth, requireGuildAccess];

const DEFAULT_SETTINGS = {
  requiredRole: null,
  allowedChannels: [],
  maxTemplates: 25,
  maxScheduled: 10,
  webhookEnabled: true,
  variablesEnabled: true,
  logChannelId: null,
};

// ── Build Discord REST API embed object from EmbedData ────────────────────────

function toDiscordEmbed(d: any): object {
  const embed: any = {};
  if (d.title) embed.title = String(d.title).slice(0, 256);
  if (d.description) embed.description = String(d.description).slice(0, 4096);
  if (d.color !== undefined) embed.color = d.color;
  if (d.url) embed.url = d.url;
  if (d.authorName) embed.author = { name: String(d.authorName).slice(0, 256), icon_url: d.authorIconUrl ?? undefined };
  if (d.footerText) embed.footer = { text: String(d.footerText).slice(0, 2048), icon_url: d.footerIconUrl ?? undefined };
  if (d.thumbnail) embed.thumbnail = { url: d.thumbnail };
  if (d.image) embed.image = { url: d.image };
  if (d.timestamp) embed.timestamp = new Date().toISOString();
  if (Array.isArray(d.fields) && d.fields.length) {
    embed.fields = d.fields.slice(0, 25).map((f: any) => ({
      name: (f.name || "\u200b").slice(0, 256),
      value: (f.value || "\u200b").slice(0, 1024),
      inline: !!f.inline,
    }));
  }
  return embed;
}

// ── Settings ──────────────────────────────────────────────────────────────────

router.get("/:guildId/embed-settings", ...auth, async (req: any, res: any) => {
  const cfg = (await dbGet<any>("embedSettings", req.params.guildId)) ?? {};
  res.json({ ...DEFAULT_SETTINGS, ...cfg });
});

router.put("/:guildId/embed-settings", ...auth, async (req: any, res: any) => {
  const existing = (await dbGet<any>("embedSettings", req.params.guildId)) ?? {};
  await dbSet("embedSettings", req.params.guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Templates ─────────────────────────────────────────────────────────────────

router.get("/:guildId/embed-templates", ...auth, async (req: any, res: any) => {
  const data = (await dbGet<Record<string, any>>("embedTemplates", req.params.guildId)) ?? {};
  res.json(Object.values(data));
});

router.post("/:guildId/embed-templates", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { name, data } = req.body;
  if (!name || !data) return res.status(400).json({ error: "name and data required" });

  const cfg = (await dbGet<any>("embedSettings", guildId)) ?? DEFAULT_SETTINGS;
  const templates = (await dbGet<Record<string, any>>("embedTemplates", guildId)) ?? {};
  const maxTemplates = cfg.maxTemplates ?? 25;

  if (Object.keys(templates).length >= maxTemplates && !templates[name.toLowerCase()]) {
    return res.status(400).json({ error: `Max ${maxTemplates} templates reached` });
  }

  templates[name.toLowerCase()] = {
    name,
    creatorId: req.session.userId,
    data,
    createdAt: Date.now(),
  };
  await dbSet("embedTemplates", guildId, templates);
  res.json({ ok: true });
});

router.delete("/:guildId/embed-templates/:name", ...auth, async (req: any, res: any) => {
  const { guildId, name } = req.params;
  const data = (await dbGet<Record<string, any>>("embedTemplates", guildId)) ?? {};
  if (!data[name.toLowerCase()]) return res.status(404).json({ error: "Template not found" });
  delete data[name.toLowerCase()];
  await dbSet("embedTemplates", guildId, data);
  res.json({ ok: true });
});

// ── Scheduled Embeds ──────────────────────────────────────────────────────────

router.get("/:guildId/embed-scheduled", ...auth, async (req: any, res: any) => {
  const data = (await dbGet<Record<string, any>>("embedScheduled", req.params.guildId)) ?? {};
  res.json(Object.values(data));
});

router.delete("/:guildId/embed-scheduled/:id", ...auth, async (req: any, res: any) => {
  const { guildId, id } = req.params;
  const data = (await dbGet<Record<string, any>>("embedScheduled", guildId)) ?? {};
  if (!data[id]) return res.status(404).json({ error: "Not found" });
  delete data[id];
  await dbSet("embedScheduled", guildId, data);
  res.json({ ok: true });
});

// ── Send embed ────────────────────────────────────────────────────────────────

router.post("/:guildId/embed-send", ...auth, async (req: any, res: any) => {
  const { channelId, embedData, webhookName, webhookAvatar } = req.body;
  if (!channelId || !embedData) return res.status(400).json({ error: "channelId and embedData required" });

  const botToken = process.env["DISCORD_BOT_TOKEN"];
  if (!botToken) return res.status(503).json({ error: "Bot token not configured — add DISCORD_BOT_TOKEN to environment secrets" });

  const discordEmbed = toDiscordEmbed(embedData);

  try {
    if (webhookName) {
      // Create a temporary webhook, send, then clean up
      const whRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "EmbedBuilder" }),
      });
      if (!whRes.ok) {
        const err = await whRes.json().catch(() => ({})) as any;
        return res.status(400).json({ error: err.message ?? "Could not create webhook — check bot has Manage Webhooks permission" });
      }
      const wh = await whRes.json() as any;

      await fetch(`https://discord.com/api/v10/webhooks/${wh.id}/${wh.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [discordEmbed],
          username: String(webhookName).slice(0, 80),
          avatar_url: webhookAvatar || undefined,
        }),
      });

      // Delete the webhook after use
      await fetch(`https://discord.com/api/v10/webhooks/${wh.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${botToken}` },
      }).catch(() => {});
    } else {
      const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [discordEmbed] }),
      });
      if (!msgRes.ok) {
        const err = await msgRes.json().catch(() => ({})) as any;
        return res.status(400).json({ error: err.message ?? "Discord rejected the message — check bot permissions in that channel" });
      }
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Internal error" });
  }
});

export default router;
