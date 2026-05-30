import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from "discord.js";
import {
  Giveaway,
  saveGiveaway,
  getGiveaway,
  getAllActiveGiveawaysGlobal,
  getGiveawayConfig,
} from "../store/giveaways";
import { getUserLevel } from "../store/levels";
import { logger } from "../../lib/logger";

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let _client: Client | null = null;

export function initGiveawayManager(client: Client): void {
  _client = client;
  const active = getAllActiveGiveawaysGlobal();
  let resumed = 0;
  for (const g of active) {
    scheduleEnd(g);
    resumed++;
  }
  logger.info({ resumed }, "Giveaway manager initialized");
}

function timerKey(g: Giveaway): string {
  return `${g.guildId}:${g.id}`;
}

export function scheduleEnd(g: Giveaway): void {
  const key = timerKey(g);
  const existing = timers.get(key);
  if (existing) { clearTimeout(existing); timers.delete(key); }
  const delay = Math.max(0, g.endTime - Date.now());
  const t = setTimeout(() => {
    timers.delete(key);
    endGiveaway(g.guildId, g.id).catch((err) =>
      logger.error({ err }, "Auto-end giveaway failed")
    );
  }, delay);
  timers.set(key, t);
}

export function cancelTimer(g: Giveaway): void {
  const t = timers.get(timerKey(g));
  if (t) { clearTimeout(t); timers.delete(timerKey(g)); }
}

export function buildGiveawayEmbed(g: Giveaway, ended = false): EmbedBuilder {
  const totalEntries = g.entries.reduce((s, e) => s + e.entries, 0);
  const uniqueEntries = g.entries.length;
  const timeStr = ended ? "🏁 Ended" : `<t:${Math.floor(g.endTime / 1000)}:R>`;

  const reqLines: string[] = [];
  if (g.requirements.requiredRoles.length > 0) {
    reqLines.push(`• Required role: ${g.requirements.requiredRoles.map((r) => `<@&${r}>`).join(" or ")}`);
  }
  if (g.requirements.blacklistRoles.length > 0) {
    reqLines.push(`• Blacklisted roles: ${g.requirements.blacklistRoles.map((r) => `<@&${r}>`).join(", ")}`);
  }
  if (g.requirements.minDays > 0) {
    reqLines.push(`• Minimum server age: **${g.requirements.minDays}** day${g.requirements.minDays !== 1 ? "s" : ""}`);
  }
  if (g.requirements.minLevel > 0) {
    reqLines.push(`• Minimum level: **${g.requirements.minLevel}**`);
  }
  if (g.bonusRoles.length > 0) {
    reqLines.push(`• Bonus entries: ${g.bonusRoles.map((b) => `<@&${b.roleId}> ×${b.entries}`).join(", ")}`);
  }
  if (g.boosterBonus > 0) {
    reqLines.push(`• Server boosters: **+${g.boosterBonus}** extra entries`);
  }
  if (g.levelBonuses.length > 0) {
    reqLines.push(`• Level bonuses: ${g.levelBonuses.map((lb) => `Lvl ${lb.minLevel}+ (+${lb.bonusEntries})`).join(", ")}`);
  }
  if (g.partnerInfo) {
    reqLines.push(`• Partner server: **${g.partnerInfo.serverName}**`);
  }

  const descParts: string[] = [];
  if (ended && g.cancelled) {
    descParts.push("❌ **This giveaway was cancelled.**");
  } else if (ended && g.winners.length > 0) {
    descParts.push(`🏆 **Winner${g.winners.length > 1 ? "s" : ""}:** ${g.winners.map((w) => `<@${w}>`).join(", ")}`);
  } else if (ended) {
    descParts.push("😢 **No valid entries — no winners.**");
  } else {
    descParts.push("🎟️ Click the button below to enter!");
  }
  descParts.push("");
  descParts.push(`📊 **Entries:** ${uniqueEntries} unique (${totalEntries} weighted)`);
  descParts.push(`🏆 **Winners:** ${g.winnerCount}`);
  descParts.push(`⏰ **Ends:** ${timeStr}`);
  descParts.push(`👤 **Hosted by:** <@${g.hostId}>`);
  if (reqLines.length > 0) {
    descParts.push("");
    descParts.push("**Requirements & Bonuses:**");
    descParts.push(...reqLines);
  }

  return new EmbedBuilder()
    .setTitle(`🎉 ${g.prize}`)
    .setColor(ended ? (g.cancelled ? 0x4f4f4f : 0x2ecc71) : 0x7c3cfa)
    .setDescription(descParts.join("\n"))
    .setFooter({ text: ended ? "Giveaway ended" : `ID: ${g.id}` })
    .setTimestamp(ended ? Date.now() : g.endTime);
}

export function buildGiveawayRow(g: Giveaway, ended = false): ActionRowBuilder<ButtonBuilder> {
  const totalEntries = g.entries.reduce((s, e) => s + e.entries, 0);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:enter:${g.id}`)
      .setLabel(ended ? "Giveaway Ended" : `🎉 Enter — ${totalEntries} entries`)
      .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(ended)
  );
}

export async function updateGiveawayMessage(g: Giveaway, ended = false): Promise<void> {
  if (!_client) return;
  try {
    const channel = await _client.channels.fetch(g.channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const msg = await (channel as TextChannel).messages.fetch(g.messageId).catch(() => null);
    if (!msg) return;
    await msg.edit({ embeds: [buildGiveawayEmbed(g, ended)], components: [buildGiveawayRow(g, ended)] });
  } catch (err) {
    logger.warn({ err }, "Failed to update giveaway message");
  }
}

export async function pickWinners(g: Giveaway, count: number): Promise<string[]> {
  if (!_client) return [];
  const pool: string[] = [];
  for (const entry of g.entries) {
    for (let i = 0; i < entry.entries; i++) pool.push(entry.userId);
  }
  if (pool.length === 0) return [];

  const guild = await _client.guilds.fetch(g.guildId).catch(() => null);
  const winners: string[] = [];
  const remaining = [...pool];
  const picked = new Set<string>();

  while (winners.length < count && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length);
    const userId = remaining[idx];
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i] === userId) remaining.splice(i, 1);
    }
    if (picked.has(userId)) continue;
    picked.add(userId);
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
    }
    winners.push(userId);
  }
  return winners;
}

export async function endGiveaway(guildId: string, id: string): Promise<Giveaway | null> {
  if (!_client) return null;
  const g = getGiveaway(guildId, id);
  if (!g || g.ended || g.cancelled) return g ?? null;

  const winners = await pickWinners(g, g.winnerCount);
  const updated: Giveaway = { ...g, ended: true, winners };
  saveGiveaway(updated);
  cancelTimer(updated);
  await updateGiveawayMessage(updated, true);

  const config = getGiveawayConfig(guildId);
  const announceChannelId = updated.announcementChannelId ?? config.announcementChannelId;

  if (winners.length > 0) {
    for (const winnerId of winners) {
      try {
        const user = await _client.users.fetch(winnerId).catch(() => null);
        if (user) {
          await user
            .send(
              `🎉 Congratulations! You won **${updated.prize}** in **${(await _client.guilds.fetch(guildId).catch(() => null))?.name ?? "a server"}**!\nCheck <#${updated.channelId}> for details.`
            )
            .catch(() => {});
        }
      } catch {}
    }

    if (announceChannelId) {
      try {
        const ch = await _client.channels.fetch(announceChannelId).catch(() => null);
        if (ch?.isTextBased()) {
          const mentions = winners.map((w) => `<@${w}>`).join(", ");
          await (ch as TextChannel).send({
            content: `🎉 Congratulations ${mentions}! You won **${updated.prize}**!\n[Jump to giveaway](https://discord.com/channels/${guildId}/${updated.channelId}/${updated.messageId})`,
          });
        }
      } catch {}
    } else {
      try {
        const ch = await _client.channels.fetch(updated.channelId).catch(() => null);
        if (ch?.isTextBased()) {
          const mentions = winners.map((w) => `<@${w}>`).join(", ");
          await (ch as TextChannel).send({
            content: `🎉 Congratulations ${mentions}! You won **${updated.prize}**!`,
          });
        }
      } catch {}
    }
  } else {
    try {
      const ch = await _client.channels.fetch(updated.channelId).catch(() => null);
      if (ch?.isTextBased()) {
        await (ch as TextChannel).send({
          content: `😢 The giveaway for **${updated.prize}** ended with no valid entries.`,
        });
      }
    } catch {}
  }

  return updated;
}

export async function rerollGiveaway(
  guildId: string,
  id: string,
  count?: number
): Promise<string[]> {
  const g = getGiveaway(guildId, id);
  if (!g || !g.ended || g.cancelled) return [];
  const newWinners = await pickWinners(g, count ?? g.winnerCount);
  const updated: Giveaway = { ...g, winners: newWinners };
  saveGiveaway(updated);
  await updateGiveawayMessage(updated, true);
  return newWinners;
}

export async function checkEntry(
  g: Giveaway,
  userId: string,
  member: any
): Promise<{ allowed: boolean; reason?: string; totalEntries: number }> {
  const memberRoles: string[] = member.roles.cache.map((r: any) => r.id);

  for (const roleId of g.requirements.blacklistRoles) {
    if (memberRoles.includes(roleId)) {
      return { allowed: false, reason: `You have a blacklisted role (<@&${roleId}>).`, totalEntries: 0 };
    }
  }

  if (g.requirements.requiredRoles.length > 0) {
    const has = g.requirements.requiredRoles.some((r) => memberRoles.includes(r));
    if (!has) {
      return {
        allowed: false,
        reason: `You need one of: ${g.requirements.requiredRoles.map((r) => `<@&${r}>`).join(", ")}.`,
        totalEntries: 0,
      };
    }
  }

  if (g.requirements.minDays > 0) {
    const joined = member.joinedTimestamp;
    if (!joined) return { allowed: false, reason: "Could not verify your join date.", totalEntries: 0 };
    const days = (Date.now() - joined) / 86_400_000;
    if (days < g.requirements.minDays) {
      return {
        allowed: false,
        reason: `You must have been in the server for at least **${g.requirements.minDays}** day${g.requirements.minDays !== 1 ? "s" : ""}.`,
        totalEntries: 0,
      };
    }
  }

  if (g.requirements.minLevel > 0) {
    const userData = getUserLevel(g.guildId, userId);
    if (userData.level < g.requirements.minLevel) {
      return {
        allowed: false,
        reason: `You need to be at least **Level ${g.requirements.minLevel}** to enter. Your level: **${userData.level}**.`,
        totalEntries: 0,
      };
    }
  }

  let totalEntries = 1;

  let bestRoleMultiplier = 1;
  for (const bonusRole of g.bonusRoles) {
    if (memberRoles.includes(bonusRole.roleId) && bonusRole.entries > bestRoleMultiplier) {
      bestRoleMultiplier = bonusRole.entries;
    }
  }
  totalEntries = bestRoleMultiplier;

  const isBooster = member.premiumSince != null;
  if (isBooster && g.boosterBonus > 0) {
    totalEntries += g.boosterBonus;
  }

  if (g.levelBonuses.length > 0) {
    const userData = getUserLevel(g.guildId, userId);
    let levelBonus = 0;
    for (const lb of g.levelBonuses) {
      if (userData.level >= lb.minLevel && lb.bonusEntries > levelBonus) {
        levelBonus = lb.bonusEntries;
      }
    }
    totalEntries += levelBonus;
  }

  return { allowed: true, totalEntries };
}
