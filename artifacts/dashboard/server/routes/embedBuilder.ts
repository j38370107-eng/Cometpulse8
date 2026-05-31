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

// ── Settings ──────────────────────────────────────────────────────────────────

router.get("/:guildId/embed-settings", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("embedSettings", guildId)) ?? {};
  res.json({ ...DEFAULT_SETTINGS, ...cfg });
});

router.put("/:guildId/embed-settings", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("embedSettings", guildId)) ?? {};
  await dbSet("embedSettings", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Templates ─────────────────────────────────────────────────────────────────

router.get("/:guildId/embed-templates", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const data = (await dbGet<Record<string, any>>("embedTemplates", guildId)) ?? {};
  res.json(Object.values(data));
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
  const { guildId } = req.params;
  const data = (await dbGet<Record<string, any>>("embedScheduled", guildId)) ?? {};
  res.json(Object.values(data));
});

router.delete("/:guildId/embed-scheduled/:id", ...auth, async (req: any, res: any) => {
  const { guildId, id } = req.params;
  const data = (await dbGet<Record<string, any>>("embedScheduled", guildId)) ?? {};
  if (!data[id]) return res.status(404).json({ error: "Scheduled embed not found" });
  delete data[id];
  await dbSet("embedScheduled", guildId, data);
  res.json({ ok: true });
});

export default router;
