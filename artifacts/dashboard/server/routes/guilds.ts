import { Router } from "express";
import { dbGet, dbSet, dbDelete, dbGetAll, dbGetByGuildPrefix } from "../db.js";
import {
  getGuildChannels,
  getGuildRoles,
  getGuildAuditLog,
  AUDIT_LOG_ACTIONS,
} from "../discord.js";

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

// ── Bot Presence Check ────────────────────────────────────────────────────────
router.get("/:guildId/bot-status", requireAuth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const botToken = process.env["DISCORD_BOT_TOKEN"];
  if (!botToken) return res.json({ present: false });
  try {
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    return res.json({ present: r.ok });
  } catch {
    return res.json({ present: false });
  }
});

// ── Overview ─────────────────────────────────────────────────────────────────
router.get("/:guildId/overview", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const guild = (req.session.guilds as any[]).find((g: any) => g.id === guildId);
  const settings = (await dbGet<any>("settings", guildId)) ?? {};
  const infractions = await dbGetByGuildPrefix("infractions", guildId);
  const timedBans = await dbGetByGuildPrefix("timedBans", guildId);
  const timedMutes = await dbGetByGuildPrefix("timedMutes", guildId);
  const shortcuts = (await dbGet<any>("shortcuts", guildId)) ?? {};
  const disabled = (await dbGet<string[]>("disabledCommands", guildId)) ?? [];

  res.json({
    guild,
    settings,
    stats: {
      totalCases: infractions.reduce((a: number, r: any) => a + (Array.isArray(r.data) ? r.data.length : 0), 0),
      activeBans: timedBans.length,
      activeMutes: timedMutes.length,
      shortcuts: Object.keys(shortcuts).length,
      disabledCommands: disabled.length,
    },
  });
});

// ── Settings ─────────────────────────────────────────────────────────────────
router.get("/:guildId/settings", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const settings = (await dbGet<any>("settings", guildId)) ?? {};
  res.json({ ...settings, prefix: settings.prefix ?? "c!" });
});

router.put("/:guildId/settings", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { prefix, serverLogChannelId, automodWarnExpiryMs } = req.body;
  const settings = (await dbGet<any>("settings", guildId)) ?? {};
  const updated: any = { ...settings };
  if (prefix !== undefined) updated.prefix = prefix;
  if ("serverLogChannelId" in req.body) updated.serverLogChannelId = serverLogChannelId;
  if (automodWarnExpiryMs !== undefined) updated.automodWarnExpiryMs = automodWarnExpiryMs;
  await dbSet("settings", guildId, updated);
  fetch(`http://localhost:3000/internal/reload/${guildId}`).catch(() => {});
  res.json({ ok: true });
});

// ── Moderation Config ─────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

router.get("/:guildId/moderation", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const [settings, muteConfig, modRoles, protectedRoles, lockdownChannels] = await Promise.all([
    dbGet<any>("settings", guildId).then((s) => s ?? {}),
    dbGet<any>("muteConfig", guildId).then((c) => c ?? {}),
    dbGet<string[]>("modroles", guildId).then((r) => r ?? []),
    dbGet<string[]>("protectedRoles", guildId).then((r) => r ?? []),
    dbGet<string[]>("lockdown", guildId).then((c) => c ?? []),
  ]);

  const warnExpiryMs = settings.warnExpiryMs ?? 30 * DAY_MS;
  const warnExpiryDays = warnExpiryMs === 0 ? "0" : String(Math.round(warnExpiryMs / DAY_MS));

  res.json({
    modRoles,
    protectedRoles,
    lockdownChannels,
    logChannelId: settings.logChannelId ?? "",
    warnExpiryDays,
    warnEscalation: settings.warnEscalation ?? { steps: [] },
    muteConfig: { mode: "timeout", muteRoleId: null, stripRoles: false, ...muteConfig },
  });
});

router.put("/:guildId/moderation", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { modRoles, protectedRoles, lockdownChannels, logChannelId, warnExpiryDays, warnEscalation, muteConfig } = req.body;

  const warnDays = parseInt(warnExpiryDays ?? "30", 10);
  const warnExpiryMs = isNaN(warnDays) ? undefined : warnDays === 0 ? 0 : warnDays * DAY_MS;

  await Promise.all([
    dbSet("modroles", guildId, Array.isArray(modRoles) ? modRoles : []),
    dbSet("protectedRoles", guildId, Array.isArray(protectedRoles) ? protectedRoles : []),
    dbSet("lockdown", guildId, Array.isArray(lockdownChannels) ? lockdownChannels : []),
    (async () => {
      const settings = (await dbGet<any>("settings", guildId)) ?? {};
      const updated: any = { ...settings };
      if (logChannelId !== undefined) updated.logChannelId = logChannelId || undefined;
      if (warnExpiryMs !== undefined) updated.warnExpiryMs = warnExpiryMs;
      if (warnEscalation !== undefined) updated.warnEscalation = warnEscalation;
      await dbSet("settings", guildId, updated);
    })(),
    muteConfig
      ? (async () => {
          const existing = (await dbGet<any>("muteConfig", guildId)) ?? {};
          await dbSet("muteConfig", guildId, { ...existing, ...muteConfig });
        })()
      : Promise.resolve(),
  ]);

  res.json({ ok: true });
});

// ── Channels & Roles (for selectors) ─────────────────────────────────────────
router.get("/:guildId/channels", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const botToken = process.env["DISCORD_BOT_TOKEN"];
  if (!botToken) return res.json([]);
  const channels = await getGuildChannels(botToken, guildId);
  res.json(channels.filter((c) => c.type === 0 || c.type === 5).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
});

router.get("/:guildId/roles", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const botToken = process.env["DISCORD_BOT_TOKEN"];
  if (!botToken) return res.json([]);
  const roles = await getGuildRoles(botToken, guildId);
  res.json(roles.filter((r) => !r.managed && r.name !== "@everyone").sort((a, b) => b.position - a.position));
});

// ── Automod ───────────────────────────────────────────────────────────────────
router.get("/:guildId/automod", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const config = await dbGet<any>("automod", guildId);
  res.json(config ?? {});
});

router.put("/:guildId/automod", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("automod", guildId)) ?? {};
  const updated = { ...existing, ...req.body };
  await dbSet("automod", guildId, updated);
  res.json({ ok: true });
});

// ── Shortcuts ─────────────────────────────────────────────────────────────────
router.get("/:guildId/shortcuts", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const data = (await dbGet<any>("shortcuts", guildId)) ?? {};
  res.json(Object.values(data));
});

router.post("/:guildId/shortcuts", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { name, type, reason, duration } = req.body;
  if (!name || !type || !reason) return res.status(400).json({ error: "name, type, reason required" });
  const data = (await dbGet<any>("shortcuts", guildId)) ?? {};
  data[name.toLowerCase()] = { name: name.toLowerCase(), type, reason, duration };
  await dbSet("shortcuts", guildId, data);
  res.json({ ok: true });
});

router.delete("/:guildId/shortcuts/:name", ...auth, async (req: any, res: any) => {
  const { guildId, name } = req.params;
  const data = (await dbGet<any>("shortcuts", guildId)) ?? {};
  delete data[name.toLowerCase()];
  await dbSet("shortcuts", guildId, data);
  res.json({ ok: true });
});

// ── Commands (enable/disable) ─────────────────────────────────────────────────
router.get("/:guildId/commands", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const disabled = (await dbGet<string[]>("disabledCommands", guildId)) ?? [];
  res.json({ disabled });
});

router.put("/:guildId/commands", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { disabled } = req.body as { disabled: string[] };
  if (!Array.isArray(disabled)) return res.status(400).json({ error: "disabled must be array" });
  await dbSet("disabledCommands", guildId, disabled);
  res.json({ ok: true });
});

// ── Command Permissions ───────────────────────────────────────────────────────
router.get("/:guildId/command-perms", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const perms = (await dbGet<any>("commandPerms", guildId)) ?? {};
  res.json(perms);
});

router.put("/:guildId/command-perms", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("commandPerms", guildId)) ?? {};
  await dbSet("commandPerms", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Cases ─────────────────────────────────────────────────────────────────────
router.get("/:guildId/cases", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const rows = await dbGetByGuildPrefix("infractions", guildId);
  const all: any[] = [];
  for (const row of rows) {
    const [, userId] = row.key.split(":");
    if (Array.isArray(row.data)) {
      for (const inf of row.data as any[]) {
        all.push({ ...inf, userId });
      }
    }
  }
  all.sort((a, b) => b.timestamp - a.timestamp);
  res.json(all.slice(0, 200));
});

router.get("/:guildId/cases/:caseId", ...auth, async (req: any, res: any) => {
  const { guildId, caseId } = req.params;
  const rows = await dbGetByGuildPrefix("infractions", guildId);
  for (const row of rows) {
    if (Array.isArray(row.data)) {
      const inf = (row.data as any[]).find((i: any) => i.id === caseId);
      if (inf) {
        const [, userId] = row.key.split(":");
        return res.json({ ...inf, userId });
      }
    }
  }
  res.status(404).json({ error: "Case not found" });
});

router.delete("/:guildId/cases/:caseId", ...auth, async (req: any, res: any) => {
  const { guildId, caseId } = req.params;
  const rows = await dbGetByGuildPrefix("infractions", guildId);
  for (const row of rows) {
    if (Array.isArray(row.data)) {
      const idx = (row.data as any[]).findIndex((i: any) => i.id === caseId);
      if (idx !== -1) {
        const updated = [...(row.data as any[])];
        updated.splice(idx, 1);
        await dbSet("infractions", row.key, updated);
        return res.json({ ok: true });
      }
    }
  }
  res.status(404).json({ error: "Case not found" });
});

// ── Active Punishments ────────────────────────────────────────────────────────
router.get("/:guildId/punishments", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const bansRaw = await dbGetByGuildPrefix("timedBans", guildId);
  const mutesRaw = await dbGetByGuildPrefix("timedMutes", guildId);
  const now = Date.now();

  const bans = bansRaw
    .map((r: any) => ({ type: "ban", ...r.data, remainingMs: r.data.expiresAt ? r.data.expiresAt - now : null }))
    .filter((b: any) => !b.expiresAt || b.expiresAt > now);

  const mutes = mutesRaw
    .map((r: any) => ({ type: "mute", ...r.data, remainingMs: r.data.expiresAt ? r.data.expiresAt - now : null }))
    .filter((m: any) => !m.expiresAt || m.expiresAt > now);

  res.json([...bans, ...mutes]);
});

// ── Logging ───────────────────────────────────────────────────────────────────
router.get("/:guildId/logging", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const settings = (await dbGet<any>("settings", guildId)) ?? {};
  const serverlog = (await dbGet<any>("serverlog", guildId)) ?? {};
  res.json({ logChannelId: settings.logChannelId, serverLogChannelId: settings.serverLogChannelId, serverlog });
});

router.put("/:guildId/logging", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { logChannelId, serverLogChannelId, serverlog } = req.body;
  const settings = (await dbGet<any>("settings", guildId)) ?? {};
  await dbSet("settings", guildId, { ...settings, logChannelId, serverLogChannelId });
  if (serverlog) await dbSet("serverlog", guildId, serverlog);
  res.json({ ok: true });
});

// ── Audit Log ─────────────────────────────────────────────────────────────────
router.get("/:guildId/audit-log", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const botToken = process.env["DISCORD_BOT_TOKEN"];
  if (!botToken) return res.json({ entries: [], users: [] });
  const data = await getGuildAuditLog(botToken, guildId, 50);
  const entries = data.audit_log_entries.map((e) => ({
    ...e,
    actionName: AUDIT_LOG_ACTIONS[e.action_type] ?? `Unknown (${e.action_type})`,
  }));
  res.json({ entries, users: data.users });
});

// ── Application Forms ─────────────────────────────────────────────────────────
router.get("/:guildId/applications", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
  res.json(Object.values(forms));
});

router.post("/:guildId/applications", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
  const count = Object.keys(forms).length;
  if (count >= 5) return res.status(400).json({ error: "Maximum 5 forms per server" });
  const form = {
    id: `${Date.now()}`,
    createdAt: Date.now(),
    active: true,
    ...req.body,
  };
  if (!form.title || !form.questions) return res.status(400).json({ error: "title and questions required" });
  forms[form.id] = form;
  await dbSet("applicationForms", guildId, forms);
  res.json(form);
});

router.put("/:guildId/applications/:formId", ...auth, async (req: any, res: any) => {
  const { guildId, formId } = req.params;
  const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
  if (!forms[formId]) return res.status(404).json({ error: "Form not found" });
  forms[formId] = { ...forms[formId], ...req.body, id: formId };
  await dbSet("applicationForms", guildId, forms);
  res.json(forms[formId]);
});

router.delete("/:guildId/applications/:formId", ...auth, async (req: any, res: any) => {
  const { guildId, formId } = req.params;
  const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
  delete forms[formId];
  await dbSet("applicationForms", guildId, forms);
  res.json({ ok: true });
});

router.get("/:guildId/applications/:formId/submissions", ...auth, async (req: any, res: any) => {
  const { guildId, formId } = req.params;
  const subs = (await dbGet<any>("applicationSubmissions", guildId)) ?? {};
  const filtered = Object.values(subs).filter((s: any) => s.formId === formId);
  res.json(filtered);
});

router.patch("/:guildId/applications/:formId/submissions/:subId", ...auth, async (req: any, res: any) => {
  const { guildId, subId } = req.params;
  const { status, reviewNote } = req.body;
  const subs = (await dbGet<any>("applicationSubmissions", guildId)) ?? {};
  if (!subs[subId]) return res.status(404).json({ error: "Submission not found" });
  subs[subId] = { ...subs[subId], status, reviewNote };
  await dbSet("applicationSubmissions", guildId, subs);
  res.json(subs[subId]);
});

// ── Mute Config ───────────────────────────────────────────────────────────────
router.get("/:guildId/mute-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("muteConfig", guildId)) ?? {};
  res.json({ mode: "timeout", muteRoleId: null, stripRoles: false, ...cfg });
});

router.put("/:guildId/mute-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("muteConfig", guildId)) ?? {};
  await dbSet("muteConfig", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Additional Info ───────────────────────────────────────────────────────────
router.get("/:guildId/additional-info", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("additionalInfo", guildId)) ?? {};
  res.json(cfg);
});

router.put("/:guildId/additional-info", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { warn, mute, kick, ban } = req.body;
  const cleaned: any = {};
  if (warn) cleaned.warn = warn; else delete cleaned.warn;
  if (mute) cleaned.mute = mute; else delete cleaned.mute;
  if (kick) cleaned.kick = kick; else delete cleaned.kick;
  if (ban) cleaned.ban = ban; else delete cleaned.ban;
  await dbSet("additionalInfo", guildId, cleaned);
  res.json({ ok: true });
});

// ── Anti-Nuke ─────────────────────────────────────────────────────────────────
router.get("/:guildId/antinuke", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("antinuke", guildId)) ?? {};
  res.json({
    enabled: false, action: "ban",
    thresholds: { channelDelete:3, channelCreate:5, roleDelete:3, roleCreate:5, ban:3, kick:5, webhookCreate:3 },
    windowMs: 10000, whitelist: [], logChannel: "",
    ...cfg,
  });
});

router.put("/:guildId/antinuke", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("antinuke", guildId)) ?? {};
  await dbSet("antinuke", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Anti-Raid ─────────────────────────────────────────────────────────────────
router.get("/:guildId/antiraid", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("antiraid", guildId)) ?? {};
  res.json({ enabled: false, action: "kick", joinThreshold: 10, joinWindowMs: 10000, lockdown: false, logChannel: "", ...cfg });
});

router.put("/:guildId/antiraid", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("antiraid", guildId)) ?? {};
  await dbSet("antiraid", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Rank Card Config ──────────────────────────────────────────────────────────
router.get("/:guildId/rank-card-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("rankCardConfig", guildId)) ?? {};
  res.json({
    bgColor1: "#0b0120",
    bgColor2: "#18064a",
    accentColor: "#7c3cfa",
    bgImageUrl: "",
    ...cfg,
  });
});

router.put("/:guildId/rank-card-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const { bgColor1, bgColor2, accentColor, bgImageUrl } = req.body;
  const existing = (await dbGet<any>("rankCardConfig", guildId)) ?? {};
  const updated = { ...existing };
  if (bgColor1 !== undefined) updated.bgColor1 = bgColor1;
  if (bgColor2 !== undefined) updated.bgColor2 = bgColor2;
  if (accentColor !== undefined) updated.accentColor = accentColor;
  if (bgImageUrl !== undefined) updated.bgImageUrl = bgImageUrl;
  await dbSet("rankCardConfig", guildId, updated);
  fetch(`http://localhost:3000/internal/reload-rank-card/${guildId}`).catch(() => {});
  res.json({ ok: true });
});

// ── Ticket Categories (Discord category channels) ─────────────────────────────
router.get("/:guildId/ticket-categories", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const botToken = process.env["DISCORD_BOT_TOKEN"];
  if (!botToken) return res.json([]);
  const { getGuildChannels: getChannels } = await import("../discord.js");
  const all = await getChannels(botToken, guildId);
  res.json(all.filter((c: any) => c.type === 4).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));
});

// ── Ticket Config ─────────────────────────────────────────────────────────────
router.get("/:guildId/ticket-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("ticketConfig", guildId)) ?? {};
  res.json(cfg);
});

router.put("/:guildId/ticket-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("ticketConfig", guildId)) ?? {};
  await dbSet("ticketConfig", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Ticket Panels ─────────────────────────────────────────────────────────────
router.get("/:guildId/ticket-panels", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const panels = (await dbGet<any>("ticketPanels", guildId)) ?? {};
  res.json(Object.values(panels));
});

router.post("/:guildId/ticket-panels", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const panels = (await dbGet<any>("ticketPanels", guildId)) ?? {};
  const panel = { createdAt: Date.now(), ...req.body };
  if (!panel.id || !panel.name) return res.status(400).json({ error: "id and name required" });
  panels[panel.id] = panel;
  await dbSet("ticketPanels", guildId, panels);
  res.json(panel);
});

router.put("/:guildId/ticket-panels/:panelId", ...auth, async (req: any, res: any) => {
  const { guildId, panelId } = req.params;
  const panels = (await dbGet<any>("ticketPanels", guildId)) ?? {};
  if (!panels[panelId]) return res.status(404).json({ error: "Panel not found" });
  panels[panelId] = { ...panels[panelId], ...req.body, id: panelId };
  await dbSet("ticketPanels", guildId, panels);
  res.json(panels[panelId]);
});

router.delete("/:guildId/ticket-panels/:panelId", ...auth, async (req: any, res: any) => {
  const { guildId, panelId } = req.params;
  const panels = (await dbGet<any>("ticketPanels", guildId)) ?? {};
  delete panels[panelId];
  await dbSet("ticketPanels", guildId, panels);
  res.json({ ok: true });
});

// ── Tickets ───────────────────────────────────────────────────────────────────
router.get("/:guildId/tickets", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const tickets = (await dbGet<any>("tickets", guildId)) ?? {};
  const sorted = Object.values(tickets).sort((a: any, b: any) => b.createdAt - a.createdAt);
  res.json(sorted);
});

router.patch("/:guildId/tickets/:ticketId", ...auth, async (req: any, res: any) => {
  const { guildId, ticketId } = req.params;
  const tickets = (await dbGet<any>("tickets", guildId)) ?? {};
  if (!tickets[ticketId]) return res.status(404).json({ error: "Ticket not found" });
  const update: any = { ...req.body };
  if (update.status === "closed" && !tickets[ticketId].closedAt) {
    update.closedAt = Date.now();
  }
  tickets[ticketId] = { ...tickets[ticketId], ...update };
  await dbSet("tickets", guildId, tickets);
  res.json(tickets[ticketId]);
});

// ── Application Config (cooldown, blacklist, staff notify) ────────────────────
router.get("/:guildId/app-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cfg = (await dbGet<any>("appConfig", guildId)) ?? {};
  res.json({ cooldownHours: 0, notifyApplicant: true, blacklist: [], ...cfg });
});

router.put("/:guildId/app-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("appConfig", guildId)) ?? {};
  await dbSet("appConfig", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Level Config ─────────────────────────────────────────────────────────────
router.get("/:guildId/level-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const config = (await dbGet<any>("levelconfig", guildId)) ?? {};
  res.json({
    enabled: true,
    channelId: null,
    xpRate: 1,
    roleRewards: [],
    noXpRoles: [],
    noXpChannels: [],
    multiplierRoles: [],
    multiplierChannels: [],
    boosterMultiplier: 1.5,
    doubleXpActive: false,
    doubleXpEnd: null,
    dmOnLevelUp: false,
    levelUpMessage: null,
    roleStack: true,
    ...config,
  });
});

router.put("/:guildId/level-config", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const existing = (await dbGet<any>("levelconfig", guildId)) ?? {};
  await dbSet("levelconfig", guildId, { ...existing, ...req.body });
  res.json({ ok: true });
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
router.get("/:guildId/leaderboard", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const rows = await dbGetByGuildPrefix("levels", guildId);
  const entries = rows.map((r: any) => ({
    userId: r.key.slice(guildId.length + 1),
    level: r.data?.level ?? 0,
    xp: r.data?.xp ?? 0,
  }));
  entries.sort((a: any, b: any) => b.xp - a.xp);
  res.json(entries.slice(0, 20));
});

// ── Custom Commands ───────────────────────────────────────────────────────────
router.get("/:guildId/custom-commands", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cmds = (await dbGet<any>("customCommands", guildId)) ?? {};
  res.json(Object.values(cmds));
});

router.post("/:guildId/custom-commands", ...auth, async (req: any, res: any) => {
  const { guildId } = req.params;
  const cmds = (await dbGet<any>("customCommands", guildId)) ?? {};
  const { id, trigger, response, allowedRoles, allowedChannels, blockedRoles, blockedChannels, cooldown, cooldownType } = req.body;
  if (!id || !trigger || !response) return res.status(400).json({ error: "id, trigger and response required" });
  if (Object.keys(cmds).length >= 50) return res.status(400).json({ error: "Custom command cap (50) reached" });
  if (Object.values(cmds).some((c: any) => c.trigger === trigger)) return res.status(400).json({ error: "Trigger already exists" });
  cmds[id] = {
    id,
    trigger: trigger.trim().toLowerCase(),
    response,
    createdAt: Date.now(),
    allowedRoles: allowedRoles ?? [],
    allowedChannels: allowedChannels ?? [],
    blockedRoles: blockedRoles ?? [],
    blockedChannels: blockedChannels ?? [],
    cooldown: Number(cooldown ?? 0),
    cooldownType: cooldownType ?? "user",
  };
  await dbSet("customCommands", guildId, cmds);
  res.json(cmds[id]);
});

router.put("/:guildId/custom-commands/:cmdId", ...auth, async (req: any, res: any) => {
  const { guildId, cmdId } = req.params;
  const cmds = (await dbGet<any>("customCommands", guildId)) ?? {};
  if (!cmds[cmdId]) return res.status(404).json({ error: "Command not found" });
  const { trigger, response, allowedRoles, allowedChannels, blockedRoles, blockedChannels, cooldown, cooldownType } = req.body;
  if (trigger && Object.values(cmds).some((c: any) => c.trigger === trigger && c.id !== cmdId)) {
    return res.status(400).json({ error: "Trigger already exists" });
  }
  cmds[cmdId] = {
    ...cmds[cmdId],
    ...(trigger ? { trigger: trigger.trim().toLowerCase() } : {}),
    ...(response ? { response } : {}),
    allowedRoles: allowedRoles ?? cmds[cmdId].allowedRoles ?? [],
    allowedChannels: allowedChannels ?? cmds[cmdId].allowedChannels ?? [],
    blockedRoles: blockedRoles ?? cmds[cmdId].blockedRoles ?? [],
    blockedChannels: blockedChannels ?? cmds[cmdId].blockedChannels ?? [],
    cooldown: cooldown !== undefined ? Number(cooldown) : (cmds[cmdId].cooldown ?? 0),
    cooldownType: cooldownType ?? cmds[cmdId].cooldownType ?? "user",
  };
  await dbSet("customCommands", guildId, cmds);
  res.json(cmds[cmdId]);
});

router.delete("/:guildId/custom-commands/:cmdId", ...auth, async (req: any, res: any) => {
  const { guildId, cmdId } = req.params;
  const cmds = (await dbGet<any>("customCommands", guildId)) ?? {};
  delete cmds[cmdId];
  await dbSet("customCommands", guildId, cmds);
  res.json({ ok: true });
});

export default router;
