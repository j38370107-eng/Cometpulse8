import { Client, AuditLogEvent, Guild, EmbedBuilder } from "discord.js";
import { getAntiNuke, AntiNukeAction } from "../store/antinuke";
import { sendSecurityLog } from "../lib/securityLog";
import { logger } from "../../lib/logger";

// ── Sliding-window action tracker ────────────────────────────────────────────
const actionLog = new Map<string, number[]>();

function record(guildId: string, userId: string, action: string, windowMs: number): number {
  const key = `${guildId}:${userId}:${action}`;
  const now = Date.now();
  const timestamps = (actionLog.get(key) ?? []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  actionLog.set(key, timestamps);
  return timestamps.length;
}

const ACTION_LABEL: Record<string, string> = {
  channelDelete: "Channel Delete",
  channelCreate: "Channel Create",
  roleDelete: "Role Delete",
  roleCreate: "Role Create",
  ban: "Ban",
  kick: "Kick",
  webhookCreate: "Webhook Create",
};

// ── Punishment ────────────────────────────────────────────────────────────────
async function punish(
  client: Client,
  guild: Guild,
  userId: string,
  userTag: string,
  action: AntiNukeAction,
  actionType: string,
  count: number,
  windowMs: number
): Promise<void> {
  const cfg = getAntiNuke(guild.id);
  const reason = `Anti-Nuke: ${count} ${ACTION_LABEL[actionType] ?? actionType} actions within ${windowMs / 1000}s`;

  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    const user = member?.user ?? await client.users.fetch(userId).catch(() => null);

    // DM the offender before punishment (ban removes them from server)
    if (user) {
      const actionLabel = action === "strip" ? "had all roles removed" : `been ${action}ned`;
      const dmEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`🛡️ Anti-Nuke Action — ${guild.name}`)
        .setDescription(
          `You have ${actionLabel} from **${guild.name}** because the anti-nuke system detected suspicious activity from your account.`
        )
        .addFields(
          { name: "Trigger", value: ACTION_LABEL[actionType] ?? actionType, inline: true },
          { name: "Count", value: `${count} within ${windowMs / 1000}s`, inline: true },
          { name: "Action", value: `\`${action}\``, inline: true }
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] }).catch(() => {});
    }

    if (action === "ban") {
      await guild.members.ban(userId, { reason });
    } else if (action === "kick" && member) {
      await member.kick(reason);
    } else if (action === "strip" && member) {
      const roles = member.roles.cache
        .filter((r) => r.id !== guild.id && r.managed === false)
        .map((r) => r.id);
      await member.roles.remove(roles, reason);
    }

    await sendSecurityLog(client, guild.id, cfg.logChannel, {
      title: "🛡️ Anti-Nuke — Triggered",
      color: 0xe74c3c,
      fields: [
        { name: "Action Taken", value: `\`${action}\``, inline: true },
        { name: "Trigger", value: ACTION_LABEL[actionType] ?? actionType, inline: true },
        { name: "Count", value: `${count} within ${windowMs / 1000}s`, inline: true },
        { name: "Offender", value: `<@${userId}> (${userId})`, inline: true },
        { name: "Tag", value: userTag, inline: true },
        { name: "Reason", value: reason },
      ],
    });

    logger.warn({ guildId: guild.id, userId, action, reason }, "Anti-nuke punishment applied");
  } catch (err) {
    logger.error({ err, userId, action }, "Anti-nuke punishment failed");
  }
}

// ── Shared handler ────────────────────────────────────────────────────────────
async function handleAction(
  client: Client,
  guild: Guild,
  actionType: keyof import("../store/antinuke").AntiNukeThresholds,
  auditType: AuditLogEvent
): Promise<void> {
  const cfg = getAntiNuke(guild.id);
  if (!cfg.enabled) return;

  let executorId: string | null = null;
  let executorTag = "Unknown#0000";

  try {
    const logs = await guild.fetchAuditLogs({ type: auditType, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.executor) {
      executorId = entry.executor.id;
      executorTag = entry.executor.tag;
    }
  } catch {
    return;
  }

  if (!executorId) return;
  if (executorId === client.user?.id) return;
  if (cfg.whitelist.includes(executorId)) return;
  if (guild.ownerId === executorId) return;

  const count = record(guild.id, executorId, actionType, cfg.windowMs);
  const threshold = cfg.thresholds[actionType];

  // Log warning as threshold is being approached (at 50% and above)
  if (count >= Math.ceil(threshold / 2) && count < threshold) {
    await sendSecurityLog(client, guild.id, cfg.logChannel, {
      title: "⚠️ Anti-Nuke — Approaching Threshold",
      color: 0xf39c12,
      fields: [
        { name: "Action", value: ACTION_LABEL[actionType] ?? actionType, inline: true },
        { name: "Progress", value: `${count}/${threshold}`, inline: true },
        { name: "Window", value: `${cfg.windowMs / 1000}s`, inline: true },
        { name: "Suspect", value: `<@${executorId}> (${executorId})`, inline: true },
        { name: "Tag", value: executorTag, inline: true },
      ],
    });
  }

  if (count >= threshold) {
    actionLog.delete(`${guild.id}:${executorId}:${actionType}`);
    await punish(client, guild, executorId, executorTag, cfg.action, actionType, count, cfg.windowMs);
  }
}

// ── Registration ──────────────────────────────────────────────────────────────
export function registerAntiNukeEvents(client: Client) {
  client.on("channelCreate", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAction(client, channel.guild, "channelCreate", AuditLogEvent.ChannelCreate);
  });

  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAction(client, channel.guild, "channelDelete", AuditLogEvent.ChannelDelete);
  });

  client.on("roleCreate", async (role) => {
    await handleAction(client, role.guild, "roleCreate", AuditLogEvent.RoleCreate);
  });

  client.on("roleDelete", async (role) => {
    await handleAction(client, role.guild, "roleDelete", AuditLogEvent.RoleDelete);
  });

  client.on("guildBanAdd", async (ban) => {
    await handleAction(client, ban.guild, "ban", AuditLogEvent.MemberBanAdd);
  });

  client.on("guildMemberRemove", async (member) => {
    const cfg = getAntiNuke(member.guild.id);
    if (!cfg.enabled) return;
    try {
      const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
      const entry = logs.entries.first();
      if (!entry || entry.target?.id !== member.id) return;
      if (Date.now() - entry.createdTimestamp > 3000) return;
      if (!entry.executor) return;
      if (entry.executor.id === client.user?.id) return;
      if (cfg.whitelist.includes(entry.executor.id)) return;
      if (member.guild.ownerId === entry.executor.id) return;

      const count = record(member.guild.id, entry.executor.id, "kick", cfg.windowMs);
      const threshold = cfg.thresholds.kick;

      if (count >= Math.ceil(threshold / 2) && count < threshold) {
        await sendSecurityLog(client, member.guild.id, cfg.logChannel, {
          title: "⚠️ Anti-Nuke — Approaching Threshold",
          color: 0xf39c12,
          fields: [
            { name: "Action", value: "Kick", inline: true },
            { name: "Progress", value: `${count}/${threshold}`, inline: true },
            { name: "Window", value: `${cfg.windowMs / 1000}s`, inline: true },
            { name: "Suspect", value: `<@${entry.executor.id}> (${entry.executor.id})`, inline: true },
            { name: "Tag", value: entry.executor.tag, inline: true },
          ],
        });
      }

      if (count >= threshold) {
        actionLog.delete(`${member.guild.id}:${entry.executor.id}:kick`);
        await punish(client, member.guild, entry.executor.id, entry.executor.tag, cfg.action, "kick", count, cfg.windowMs);
      }
    } catch { /* no audit log access */ }
  });

  client.on("webhookUpdate", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAction(client, channel.guild, "webhookCreate", AuditLogEvent.WebhookCreate);
  });
}
