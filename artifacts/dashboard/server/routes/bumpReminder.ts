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
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}
const auth = [requireAuth, requireGuildAccess];

const CONFIG_STORE = "bumpReminderConfig";
const STATE_STORE = "bumpReminderState";

const CONFIG_DEFAULTS = {
  enabled: false,
  channelId: null,
  reminderMessage: "⏰ It's been 2 hours! Time to bump the server with `/bump`!",
  roleId: null,
  autoDelete: false,
};

router.get("/:guildId/bump-reminder/config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const stored = (await dbGet<any>(CONFIG_STORE, guildId)) ?? {};
  res.json({ ...CONFIG_DEFAULTS, ...stored });
});

router.put("/:guildId/bump-reminder/config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>(CONFIG_STORE, guildId)) ?? {};
  const updated = { ...CONFIG_DEFAULTS, ...existing, ...req.body };
  await dbSet(CONFIG_STORE, guildId, updated);
  res.json({ ok: true });
});

router.get("/:guildId/bump-reminder/state", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const stored = (await dbGet<any>(STATE_STORE, guildId)) ?? {};
  res.json({
    lastBumpedAt: null,
    lastBumpedBy: null,
    reminderMessageId: null,
    ...stored,
  });
});

export default router;
