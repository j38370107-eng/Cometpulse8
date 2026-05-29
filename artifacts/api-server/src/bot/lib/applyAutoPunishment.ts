import { Client, Guild, GuildMember } from "discord.js";
import { addInfraction, type Infraction } from "../store/infractions";
import { sendDmNotification } from "./dmNotify";
import { sendModLog } from "./modlog";
import { logger } from "../../lib/logger";
import type { AutomodAction } from "../store/automod";
import { getAutomodWarnExpiry } from "../store/expiry";
import { addTimedMute, scheduleTimedMute } from "../store/timedMutes";
import { getMuteConfig } from "../store/muteConfig";

const DURATION_RE = /^(\d+)(s|m|h|d)$/i;

function parseDurationSeconds(input: string): number | null {
  const match = input.match(DURATION_RE);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 1);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(seconds / 3600);
  if (h < 24) return `${h}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export async function applyAutoPunishment(
  client: Client,
  guild: Guild,
  member: GuildMember,
  action: AutomodAction,
  reason: string,
  duration?: string,
  existingWarnInfraction?: Infraction,
): Promise<void> {
  const botTag = client.user?.tag ?? "AutoMod";
  const botId = client.user?.id ?? "0";

  try {
    if (action === "warn") {
      const automodExpiry = getAutomodWarnExpiry(guild.id);
      const expiresAt = existingWarnInfraction?.expiresAt ?? (automodExpiry === 0 ? undefined : Date.now() + automodExpiry);
      const infraction = existingWarnInfraction ?? addInfraction(guild.id, member.id, {
        type: "Warn",
        reason,
        moderatorId: botId,
        moderatorTag: botTag,
        expiresAt,
        automod: true,
      });
      await sendDmNotification(member.user, {
        action: "Warned",
        guildName: guild.name,
        reason,
        caseId: infraction.id,
        expiresAt,
        additionalInfo: "This warning was issued automatically by AutoMod.",
      });
      await sendModLog(client, guild.id, {
        action: "AutoMod — Member Warned",
        executor: { tag: botTag, id: botId },
        target: { tag: member.user.tag, id: member.id },
        reason,
        color: 0xf1c40f,
        caseId: infraction.id,
      });
    } else if (action === "mute" && duration) {
      const seconds = parseDurationSeconds(duration);
      if (!seconds) return;
      const expiresAt = Date.now() + seconds * 1000;

      const infraction = addInfraction(guild.id, member.id, {
        type: "Mute",
        reason,
        moderatorId: botId,
        moderatorTag: botTag,
        expiresAt,
        automod: true,
      });

      const muteCfg = getMuteConfig(guild.id);

      if (muteCfg.mode === "role" && muteCfg.muteRoleId) {
        // ── Role mode ──────────────────────────────────────────────────────
        const muteRole = guild.roles.cache.get(muteCfg.muteRoleId);
        if (muteRole) {
          let strippedRoles: string[] | undefined;
          if (muteCfg.stripRoles) {
            strippedRoles = member.roles.cache
              .filter((r) => r.id !== guild.id && r.id !== muteRole.id)
              .map((r) => r.id);
            await member.roles.set([muteRole.id], reason);
          } else {
            await member.roles.add(muteRole, reason);
          }
          const timedMute = {
            guildId: guild.id,
            userId: member.id,
            guildName: guild.name,
            expiresAt,
            strippedRoles,
          };
          addTimedMute(timedMute);
          scheduleTimedMute(client, timedMute);
        } else {
          // Role missing — fall back to timeout
          await member.timeout(seconds * 1000, reason);
          const timedMute = { guildId: guild.id, userId: member.id, guildName: guild.name, expiresAt };
          addTimedMute(timedMute);
          scheduleTimedMute(client, timedMute);
        }
      } else {
        // ── Timeout mode ───────────────────────────────────────────────────
        await member.timeout(seconds * 1000, reason);
        const timedMute = { guildId: guild.id, userId: member.id, guildName: guild.name, expiresAt };
        addTimedMute(timedMute);
        scheduleTimedMute(client, timedMute);
      }

      await sendDmNotification(member.user, {
        action: "Muted",
        guildName: guild.name,
        reason,
        caseId: infraction.id,
        duration: formatDuration(seconds),
        expiresAt,
        additionalInfo: "This mute was applied automatically by AutoMod.",
      });
      await sendModLog(client, guild.id, {
        action: `AutoMod — Member Muted (${formatDuration(seconds)})`,
        executor: { tag: botTag, id: botId },
        target: { tag: member.user.tag, id: member.id },
        reason,
        color: 0xf39c12,
        caseId: infraction.id,
      });
    } else if (action === "kick") {
      const infraction = addInfraction(guild.id, member.id, {
        type: "Kick",
        reason,
        moderatorId: botId,
        moderatorTag: botTag,
        automod: true,
      });
      await sendDmNotification(member.user, {
        action: "Kicked",
        guildName: guild.name,
        reason,
        caseId: infraction.id,
        additionalInfo: "This kick was applied automatically by AutoMod.",
      });
      await member.kick(reason);
      await sendModLog(client, guild.id, {
        action: "AutoMod — Member Kicked",
        executor: { tag: botTag, id: botId },
        target: { tag: member.user.tag, id: member.id },
        reason,
        color: 0xe67e22,
        caseId: infraction.id,
      });
    } else if (action === "ban") {
      const infraction = addInfraction(guild.id, member.id, {
        type: "Ban",
        reason,
        moderatorId: botId,
        moderatorTag: botTag,
        automod: true,
      });
      await sendDmNotification(member.user, {
        action: "Banned",
        guildName: guild.name,
        reason,
        caseId: infraction.id,
        additionalInfo: "This ban was applied automatically by AutoMod.",
      });
      await guild.members.ban(member.id, { reason });
      await sendModLog(client, guild.id, {
        action: "AutoMod — Member Banned",
        executor: { tag: botTag, id: botId },
        target: { tag: member.user.tag, id: member.id },
        reason,
        color: 0xe74c3c,
        caseId: infraction.id,
      });
    }
  } catch (err) {
    logger.error({ err, action, userId: member.id }, "AutoMod punishment failed");
  }
}
