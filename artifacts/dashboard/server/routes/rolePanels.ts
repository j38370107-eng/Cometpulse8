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

const STORE = "rolePanels";

// GET all panels for a guild
router.get("/:guildId/role-panels", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const data = (await dbGet<Record<string, any>>(STORE, guildId)) ?? {};
  res.json(Object.values(data));
});

// GET one panel
router.get("/:guildId/role-panels/:panelId", ...auth, async (req: any, res: any) => {
  const { guildId, panelId } = req.params;
  const data = (await dbGet<Record<string, any>>(STORE, guildId)) ?? {};
  const panel = data[panelId];
  if (!panel) return res.status(404).json({ error: "Panel not found" });
  res.json(panel);
});

// POST create panel
router.post("/:guildId/role-panels", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<Record<string, any>>(STORE, guildId)) ?? {};
  const id = crypto.randomUUID();
  const panel = {
    id,
    guildId,
    channelId: "",
    messageId: null,
    type: "button",
    title: "Role Selection",
    description: "",
    color: "#7c3cfa",
    thumbnail: "",
    image: "",
    footer: "",
    mode: "toggle",
    roles: [],
    restrictions: { maxRoles: 0, minAccountAgeDays: 0, requiredRoles: [], blacklistRoles: [], requiredLevel: 0 },
    logChannelId: null,
    createdAt: Date.now(),
    ...req.body,
    id,
    guildId,
  };
  existing[id] = panel;
  await dbSet(STORE, guildId, existing);
  res.json(panel);
});

// PUT update panel
router.put("/:guildId/role-panels/:panelId", ...auth, async (req: any, res: any) => {
  const { guildId, panelId } = req.params;
  const existing = (await dbGet<Record<string, any>>(STORE, guildId)) ?? {};
  if (!existing[panelId]) return res.status(404).json({ error: "Panel not found" });
  existing[panelId] = { ...existing[panelId], ...req.body, id: panelId, guildId };
  await dbSet(STORE, guildId, existing);
  res.json(existing[panelId]);
});

// DELETE panel
router.delete("/:guildId/role-panels/:panelId", ...auth, async (req: any, res: any) => {
  const { guildId, panelId } = req.params;
  const existing = (await dbGet<Record<string, any>>(STORE, guildId)) ?? {};
  if (!existing[panelId]) return res.status(404).json({ error: "Panel not found" });
  delete existing[panelId];
  await dbSet(STORE, guildId, existing);
  res.json({ ok: true });
});

async function callBot(path: string, opts?: RequestInit): Promise<{ ok: boolean; status: number; body: any }> {
  const botPort = process.env["BOT_PORT"] ?? process.env["PORT"] ?? "3000";
  let r: Response;
  try {
    r = await fetch(`http://127.0.0.1:${botPort}${path}`, opts);
  } catch (err: any) {
    return { ok: false, status: 503, body: { error: "Bot not reachable: " + err.message } };
  }
  const text = await r.text().catch(() => "");
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    if (!r.ok) {
      body = { error: "Bot not connected or starting up (status " + r.status + ")" };
    } else {
      body = { error: "Unexpected response from bot" };
    }
  }
  return { ok: r.ok, status: r.status, body };
}

// POST to channel (calls bot internal API)
router.post("/:guildId/role-panels/:panelId/post", ...auth, async (req: any, res: any) => {
  const { guildId, panelId } = req.params;
  const { ok, status, body } = await callBot(`/internal/post-role-panel/${guildId}/${panelId}`, { method: "POST" });
  res.status(ok ? 200 : status).json(body);
});

// POST attach reactions to an existing message by ID (reaction panels only)
router.post("/:guildId/role-panels/:panelId/attach", ...auth, async (req: any, res: any) => {
  const { guildId, panelId } = req.params;
  const { messageId, channelId } = req.body as { messageId?: string; channelId?: string };
  if (!messageId) return res.status(400).json({ error: "messageId is required" });
  const { ok, status, body } = await callBot(`/internal/attach-role-panel/${guildId}/${panelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, channelId }),
  });
  res.status(ok ? 200 : status).json(body);
});

export default router;
