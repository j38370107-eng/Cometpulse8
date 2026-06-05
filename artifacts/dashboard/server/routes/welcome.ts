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

const DEFAULTS = {
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeEmbed: true,
  welcomeMessage: "Welcome to **{server}**, {user}! You are member **#{count}**.",
  welcomeEmbedColor: "#7c3cfa",
  welcomeEmbedTitle: "👋 Welcome!",
  welcomeEmbedFooter: "",

  goodbyeEnabled: false,
  goodbyeChannelId: null,
  goodbyeEmbed: false,
  goodbyeMessage: "**{username}** has left **{server}**. They were here for {duration}.",
  goodbyeEmbedColor: "#ef4444",
  goodbyeEmbedTitle: "Goodbye",
  goodbyeEmbedFooter: "",

  autoRoleEnabled: false,
  autoRoles: [],
  botAutoRoles: [],

  dmEnabled: false,
  dmMessage: "Welcome to **{server}**! We're glad to have you here. 🎉",

  showInviter: true,
};

router.get("/:guildId/welcome", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const stored = (await dbGet<any>("welcome", guildId)) ?? {};
  res.json({ ...DEFAULTS, ...stored });
});

router.put("/:guildId/welcome", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("welcome", guildId)) ?? {};
  await dbSet("welcome", guildId, { ...existing, ...req.body });
  const botUrl = (process.env["BOT_API_URL"] ?? "http://localhost:3000").replace(/\/$/, "");
  fetch(`${botUrl}/internal/reload-welcome/${guildId}`, { method: "POST" }).catch(() => {});
  res.json({ ok: true });
});

// Invite leaderboard from DB
router.get("/:guildId/invite-leaderboard", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const data = (await dbGet<any>("invites", guildId)) ?? {};
  const lb = Object.values(data)
    .map((r: any) => ({ ...r, fakeCount: r.fakeCount ?? 0 }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 25);
  res.json(lb);
});

export default router;
