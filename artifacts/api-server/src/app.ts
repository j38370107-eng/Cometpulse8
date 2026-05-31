import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { reloadGuildSettings } from "./bot/store/settings";
import { dbGet, dbSet } from "./bot/store/db";
import { setRankCardConfig } from "./bot/store/rankCardConfig";
import { endGiveaway, rerollGiveaway, cancelTimer } from "./bot/giveaway/manager";
import { getGiveaway, saveGiveaway } from "./bot/store/giveaways";
import { getPanel, savePanel, indexPanel } from "./bot/store/rolePanel";
import { buildPanelEmbed, buildPanelComponents } from "./bot/rolePanel/builder";
import type { Client } from "discord.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/ping', (req, res) => res.send('OK'));

app.post('/internal/reload/:guildId', async (req: any, res: any) => {
  try {
    await reloadGuildSettings(req.params.guildId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "reload failed" });
  }
});

app.post('/internal/reload-rank-card/:guildId', async (req: any, res: any) => {
  try {
    const { guildId } = req.params;
    const cfg = await dbGet<any>("rankCardConfig", guildId);
    if (cfg) setRankCardConfig(guildId, cfg);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "reload failed" });
  }
});

app.post('/internal/giveaway-cancel/:guildId/:id', async (req: any, res: any) => {
  try {
    const { guildId, id } = req.params;
    const g = getGiveaway(guildId, id);
    if (!g) return res.status(404).json({ error: "not found" });
    cancelTimer(g);
    const updated = { ...g, cancelled: true, ended: true };
    saveGiveaway(updated);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "cancel failed" });
  }
});

app.get('/internal/giveaway-reroll/:guildId/:id', async (req: any, res: any) => {
  try {
    const { guildId, id } = req.params;
    const winners = await rerollGiveaway(guildId, id);
    res.json({ winners });
  } catch {
    res.status(500).json({ error: "reroll failed" });
  }
});

// ── Role Panel: Post to Discord ───────────────────────────────────────────────
let _panelClient: Client | null = null;
export function setPanelClient(client: Client): void { _panelClient = client; }

app.post("/internal/post-role-panel/:guildId/:panelId", async (req: any, res: any) => {
  if (!_panelClient) return res.status(503).json({ error: "Bot not connected" });
  const { guildId, panelId } = req.params;
  try {
    const panel = getPanel(guildId, panelId);
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    if (!panel.roles.length) return res.status(400).json({ error: "No roles added to panel" });

    const guild = _panelClient.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Guild not in cache" });

    const ch = guild.channels.cache.get(panel.channelId) as import("discord.js").TextChannel | undefined;
    if (!ch?.isTextBased()) return res.status(404).json({ error: "Channel not found or not text" });

    const embed = buildPanelEmbed(panel);
    const components = buildPanelComponents(panel);
    const msg = await (ch as import("discord.js").TextChannel).send({ embeds: [embed], components });

    if (panel.type === "reaction") {
      for (const role of panel.roles) {
        if (role.emoji) await msg.react(role.emoji).catch(() => {});
      }
    }

    const updated = { ...panel, messageId: msg.id };
    savePanel(updated);
    indexPanel(updated);

    res.json({ ok: true, messageId: msg.id });
  } catch (err: any) {
    logger.error({ err }, "Failed to post role panel");
    res.status(500).json({ error: err.message });
  }
});

// ── Role Panel: Attach reactions to an existing message by ID ─────────────────
app.post("/internal/attach-role-panel/:guildId/:panelId", async (req: any, res: any) => {
  if (!_panelClient) return res.status(503).json({ error: "Bot not connected" });
  const { guildId, panelId } = req.params;
  const { messageId, channelId } = req.body as { messageId?: string; channelId?: string };

  if (!messageId) return res.status(400).json({ error: "messageId is required" });

  try {
    const panel = getPanel(guildId, panelId);
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    if (panel.type !== "reaction") return res.status(400).json({ error: "Only reaction panels can be attached to existing messages" });
    if (!panel.roles.length) return res.status(400).json({ error: "No roles added to panel" });

    const guild = _panelClient.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Guild not in cache" });

    const targetChannelId = channelId || panel.channelId;
    if (!targetChannelId) return res.status(400).json({ error: "No channel specified" });

    const ch = guild.channels.cache.get(targetChannelId) as import("discord.js").TextChannel | undefined;
    if (!ch?.isTextBased()) return res.status(404).json({ error: "Channel not found or not text-based" });

    let msg: import("discord.js").Message;
    try {
      msg = await (ch as import("discord.js").TextChannel).messages.fetch(messageId);
    } catch {
      return res.status(404).json({ error: "Message not found — make sure the message ID and channel are correct" });
    }

    for (const role of panel.roles) {
      if (role.emoji) await msg.react(role.emoji).catch(() => {});
    }

    const updated = { ...panel, messageId: msg.id, channelId: targetChannelId };
    savePanel(updated);
    indexPanel(updated);

    res.json({ ok: true, messageId: msg.id });
  } catch (err: any) {
    logger.error({ err }, "Failed to attach role panel reactions");
    res.status(500).json({ error: err.message });
  }
});

app.use("/api", router);

export default app;
