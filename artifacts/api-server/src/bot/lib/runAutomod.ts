import { Client, Message } from "discord.js";
import { logger } from "../../lib/logger";
import { checkMessage } from "./automodChecker";
import { getPunishmentForStrikes, getAutomodConfig } from "../store/automod";
import { applyAutoPunishment } from "./applyAutoPunishment";
import { sendModLog } from "./modlog";
import { addInfraction, getActiveAutomodWarnCount } from "../store/infractions";
import { getAutomodWarnExpiry } from "../store/expiry";
import { sendDmNotification } from "./dmNotify";
import { getAdditionalInfo } from "../store/additionalInfo";

/**
 * Run all automod checks against a message (used for both new and edited messages).
 * Returns true if the message triggered automod and was deleted.
 */
export async function runAutomod(client: Client, message: Message): Promise<boolean> {
  if (!message.guild) return false;
  if (message.author.bot) return false;

  const result = checkMessage(message);
  if (!result.triggered) return false;

  const guildId = message.guild.id;
  await message.delete().catch(() => {});

  const userId = message.author.id;
  const botTag = client.user?.tag ?? "AutoMod";
  const botId = client.user?.id ?? "0";
  const warnReason = `AutoMod: ${result.module} — ${result.reason}`;

  const automodExpiry = getAutomodWarnExpiry(guildId);
  const expiresAt = automodExpiry === 0 ? undefined : Date.now() + automodExpiry;
  const warnInfraction = addInfraction(guildId, userId, {
    type: "Warn",
    reason: warnReason,
    moderatorId: botId,
    moderatorTag: botTag,
    expiresAt,
    automod: true,
  });

  const strikeCount = getActiveAutomodWarnCount(guildId, userId);
  const step = getPunishmentForStrikes(guildId, strikeCount);

  await sendDmNotification(message.author, {
    action: "Warned",
    guildName: message.guild.name,
    reason: warnReason,
    caseId: warnInfraction.id,
    expiresAt,
    additionalInfo: getAdditionalInfo(guildId, "warn"),
    description: `You received an automated warning (strike ${strikeCount}). Further violations may result in escalated punishment.`,
  });

  const isSilent = getAutomodConfig(guildId).silent;
  if (!isSilent) {
    const notice = await message.channel
      .send(`⚠️ <@${userId}> — **${result.module}**: ${result.publicReason ?? result.reason}. (AutoMod warn ${strikeCount})`)
      .catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 7000);
  }

  await sendModLog(client, guildId, {
    action: `AutoMod — Message Deleted (${result.module})`,
    executor: { tag: botTag, id: botId },
    target: { tag: message.author.tag, id: userId },
    channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
    reason: `${result.reason} — Strike ${strikeCount}`,
    color: 0xe67e22,
    caseId: warnInfraction.id,
  });

  logger.info({ userId, guildId, module: result.module, strikeCount }, "AutoMod triggered");

  if (step && message.member) {
    await applyAutoPunishment(
      client,
      message.guild,
      message.member,
      step.action,
      warnReason,
      step.duration,
      step.action === "warn" ? warnInfraction : undefined,
    );
  }

  return true;
}
