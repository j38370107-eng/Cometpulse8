import { Router } from "express";
import { dbGet, dbSet, dbGetAll } from "../db.js";

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

const CONFIG_DEFAULTS = {
  channelId: null,
  mode: "normal",
  resetOnFail: true,
  deleteWrong: true,
  milestoneInterval: 100,
  milestoneRoleId: null,
  milestoneEmoji: "🎉",
  failPunishment: "nothing",
  reactEmoji: "✅",
  updateTopic: true,
  noSameUserTwice: true,
  checkpointInterval: 0,
};

const STATE_DEFAULTS = {
  currentCount: 0,
  highScore: 0,
  lastUserId: null,
  totalFails: 0,
  lastFailUserId: null,
};

router.get("/:guildId/counting/config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const stored = (await dbGet<any>("countingConfig", guildId)) ?? {};
  res.json({ ...CONFIG_DEFAULTS, ...stored });
});

router.put("/:guildId/counting/config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("countingConfig", guildId)) ?? {};
  await dbSet("countingConfig", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

router.get("/:guildId/counting/state", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const stored = (await dbGet<any>("countingState", guildId)) ?? {};
  res.json({ ...STATE_DEFAULTS, ...stored });
});

router.post("/:guildId/counting/set-count", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { count } = req.body;
  if (typeof count !== "number" || count < 0) {
    return res.status(400).json({ error: "Invalid count value" });
  }
  const existing = (await dbGet<any>("countingState", guildId)) ?? {};
  await dbSet("countingState", guildId, {
    ...STATE_DEFAULTS,
    ...existing,
    currentCount: count,
    highScore: Math.max(existing.highScore ?? 0, count),
    lastUserId: null,
    lastMessageId: null,
  });
  res.json({ ok: true });
});

router.post("/:guildId/counting/reset", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { resetStats } = req.body;
  const existing = (await dbGet<any>("countingState", guildId)) ?? {};
  await dbSet("countingState", guildId, {
    ...STATE_DEFAULTS,
    highScore: existing.highScore ?? 0,
    totalFails: existing.totalFails ?? 0,
    lastFailUserId: existing.lastFailUserId ?? null,
  });
  if (resetStats) {
    await dbSet("countingStats", guildId, []);
  }
  res.json({ ok: true });
});

router.get("/:guildId/counting/stats", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const stats = (await dbGet<any[]>("countingStats", guildId)) ?? [];
  res.json(Array.isArray(stats) ? stats : []);
});

export default router;
