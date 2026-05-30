import { Router } from "express";
import { dbGet, dbSet, dbGetByGuildPrefix } from "../db.js";

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

// ── Giveaway Config ───────────────────────────────────────────────────────────
router.get("/:guildId/giveaway-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("giveawayConfig", guildId)) ?? {};
  res.json({
    announcementChannelId: null,
    defaultBoosterBonus: 0,
    defaultRequiredRoles: [],
    defaultBlacklistRoles: [],
    defaultBonusRoles: [],
    defaultLevelBonuses: [],
    managerRoles: [],
    ...cfg,
  });
});

router.put("/:guildId/giveaway-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("giveawayConfig", guildId)) ?? {};
  await dbSet("giveawayConfig", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Giveaways list ────────────────────────────────────────────────────────────
router.get("/:guildId/giveaways", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const rows = await dbGetByGuildPrefix("giveaways", guildId);
  const giveaways = rows
    .map((r: any) => r.data)
    .sort((a: any, b: any) => b.endTime - a.endTime);
  res.json(giveaways);
});

// ── Single giveaway ───────────────────────────────────────────────────────────
router.get("/:guildId/giveaways/:id", ...auth, async (req: any, res: any) => {
  const { guildId, id } = req.params;
  const g = await dbGet<any>("giveaways", `${guildId}:${id}`);
  if (!g) return res.status(404).json({ error: "Giveaway not found" });
  res.json(g);
});

// ── Cancel from dashboard ─────────────────────────────────────────────────────
router.post("/:guildId/giveaways/:id/cancel", ...auth, async (req: any, res: any) => {
  const { guildId, id } = req.params;
  const g = await dbGet<any>("giveaways", `${guildId}:${id}`);
  if (!g) return res.status(404).json({ error: "Giveaway not found" });
  if (g.ended || g.cancelled) return res.status(400).json({ error: "Giveaway already ended" });
  await dbSet("giveaways", `${guildId}:${id}`, { ...g, cancelled: true, ended: true });
  // Signal bot to cancel timer
  fetch(`http://localhost:3000/internal/giveaway-cancel/${guildId}/${id}`).catch(() => {});
  res.json({ ok: true });
});

// ── Reroll from dashboard ─────────────────────────────────────────────────────
router.post("/:guildId/giveaways/:id/reroll", ...auth, async (req: any, res: any) => {
  const { guildId, id } = req.params;
  const g = await dbGet<any>("giveaways", `${guildId}:${id}`);
  if (!g) return res.status(404).json({ error: "Giveaway not found" });
  if (!g.ended) return res.status(400).json({ error: "Giveaway has not ended yet" });
  // Signal bot to reroll
  try {
    const r = await fetch(`http://localhost:3000/internal/giveaway-reroll/${guildId}/${id}`);
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(503).json({ error: "Bot is not responding" });
  }
});

export default router;
