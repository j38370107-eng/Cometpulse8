import { Router } from "express";
import { dbGet, dbSet } from "../db.js";

const router = Router();

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function sendToDiscord(channelId: string, form: any, submission: any) {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token || !channelId) return;

  const fields = form.questions
    .filter((q: any) => submission.answers?.[q.id] !== undefined)
    .map((q: any) => ({
      name: q.label,
      value: submission.answers[q.id]?.trim() || "_No answer_",
      inline: false,
    }));

  const body = {
    embeds: [
      {
        title: `📋 New Application — ${form.title}`,
        color: 0xf0a500,
        fields: [
          { name: "Applicant", value: submission.userTag, inline: true },
          { name: "Status", value: "🟡 Pending", inline: true },
          ...fields,
        ],
        footer: { text: `Submission ID: ${submission.id}` },
        timestamp: new Date(submission.submittedAt).toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "Approve",
            custom_id: `apply:approve:${submission.guildId}:${submission.id}`,
          },
          {
            type: 2,
            style: 4,
            label: "Deny",
            custom_id: `apply:deny:${submission.guildId}:${submission.id}`,
          },
        ],
      },
    ],
  };

  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[apply] Discord send failed (${res.status}):`, err);
  }
}

router.get("/:guildId/:formId", async (req: any, res: any) => {
  const { guildId, formId } = req.params;
  const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
  const form = forms[formId];
  if (!form) return res.status(404).json({ error: "Form not found" });
  if (!form.active) return res.status(403).json({ error: "This form is not currently accepting submissions" });

  // Blacklist check — uses the logged-in user's id from session if present
  const userId = (req as any).session?.userId ?? (req as any).user?.id;
  if (userId) {
    const blacklist: string[] = (await dbGet<string[]>("appBlacklist", guildId)) ?? [];
    if (blacklist.includes(userId)) {
      return res.status(403).json({ error: "You have been blocked from submitting applications in this server." });
    }
  }

  const { id, title, description, questions } = form;
  res.json({ id, title, description, questions });
});

router.post("/:guildId/:formId", async (req: any, res: any) => {
  const { guildId, formId } = req.params;
  const { userId, userTag, answers } = req.body as { userId?: string; userTag: string; answers: Record<string, string> };

  if (!userTag?.trim()) return res.status(400).json({ error: "Discord username is required" });

  const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
  const form = forms[formId];
  if (!form) return res.status(404).json({ error: "Form not found" });
  if (!form.active) return res.status(403).json({ error: "This form is not currently accepting submissions" });

  // Blacklist check
  if (userId) {
    const blacklist: string[] = (await dbGet<string[]>("appBlacklist", guildId)) ?? [];
    if (blacklist.includes(userId)) {
      return res.status(403).json({ error: "You have been blocked from submitting applications in this server." });
    }
  }

  const subs = (await dbGet<any>("applicationSubmissions", guildId)) ?? {};
  const id = generateId();
  const submission = {
    id,
    formId,
    guildId,
    userId: userId ?? null,
    userTag: userTag.trim(),
    answers: answers ?? {},
    status: "pending",
    submittedAt: Date.now(),
  };
  subs[id] = submission;
  await dbSet("applicationSubmissions", guildId, subs);

  // Fire-and-forget — don't block the response on Discord delivery
  if (form.responseChannelId) {
    sendToDiscord(form.responseChannelId, form, submission).catch((e) =>
      console.error("[apply] sendToDiscord error:", e)
    );
  }

  res.json({ ok: true });
});

export default router;
