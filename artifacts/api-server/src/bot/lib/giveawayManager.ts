import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  Guild,
} from "discord.js";
import { logger } from "../../lib/logger";
import {
  Giveaway,
  getAllActiveGiveaways,
  updateGiveaway,
  getGiveaway,
  getGiveawayByMessage,
} from "../store/giveaways";

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Duration parser ───────────────────────────────────────────────────────────
export function parseDuration(str: string): number | null {
  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let ms = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(str)) !== null) {
    matched = true;
    const n = parseInt(m[1], 10);
    switch (m[2].toLowerCase()) {
      case "d": ms += n * 86_400_000; break;
      case "h": ms += n * 3_600_000; break;
      case "m": ms += n * 60_000; break;
      case "s": ms += n * 1_000; break;
    }
  }
  return matched ? ms : null;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && !d) parts.push(`${s}s`);
  return parts.join(" ") || "< 1s";
}

// ── Weighted random winner selection ──────────────────────────────────────────
export function pickWinners(giveaway: Giveaway, count: number): string[] {
  const pool: string[] = [];
  for (const entry of giveaway.entries) {
    for (let i = 0; i < entry.totalEntries; i++) {
      pool.push(entry.userId);
    }
  }

  const winners: string[] = [];
  const used = new Set<string>();

  while (winners.length < count && pool.filter(id => !used.has(id)).length > 0) {
    const eligible = pool.filter(id => !used.has(id));
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    winners.push(pick);
    used.add(pick);
  }

  return winners;
}

// ── Embed builder ─────────────────────────────────────────────────────────────
export function buildGiveawayEmbed(giveaway: Giveaway, ended = false): EmbedBuilder {
  const { prize, winnerCount, endsAt, entries, requirements, bonus, type, partnerServer, description, winners } = giveaway;

  const reqs: string[] = [];
  if (requirements.requiredRoles.length) {
    reqs.push(`• Role required: ${requirements.requiredRoles.map(r => `<@&${r}>`).join(", ")}`);
  }
  if (requirements.minLevel > 0) reqs.push(`• Minimum level: **${requirements.minLevel}**`);
  if (requirements.minAccountAgeDays > 0) reqs.push(`• Account age: **${requirements.minAccountAgeDays}+ days**`);
  if (requirements.minServerAgeDays > 0) reqs.push(`• Server age: **${requirements.minServerAgeDays}+ days**`);
  if (requirements.minMessages > 0) reqs.push(`• Min messages: **${requirements.minMessages}**`);
  if (requirements.blacklistRoles.length) {
    reqs.push(`• Blacklisted roles: ${requirements.blacklistRoles.map(r => `<@&${r}>`).join(", ")}`);
  }

  const bonusLines: string[] = [];
  if (bonus.boosterEnabled) bonusLines.push(`• Server boosters: **+${bonus.boosterBonus}** entries`);
  for (const rule of bonus.roleMultipliers) {
    bonusLines.push(`• <@&${rule.roleId}>: **+${rule.bonus}** entries`);
  }
  for (const lb of bonus.levelBonuses) {
    bonusLines.push(`• Level ${lb.minLevel}+: **+${lb.bonus}** entries`);
  }

  const typeLabel: Record<string, string> = {
    normal: "🌐 Normal",
    "role-locked": "🔒 Role-Locked",
    "level-gated": "⭐ Level-Gated",
    partner: "🤝 Partner",
  };

  const totalEntries = entries.length;

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x5865f2 : 0xf0a500)
    .setTitle(ended ? `🎊 GIVEAWAY ENDED — ${prize}` : `🎉 GIVEAWAY — ${prize}`)
    .setTimestamp();

  if (description) embed.setDescription(description);

  embed.addFields(
    { name: "🏆 Winners", value: String(winnerCount), inline: true },
    { name: "🎭 Type", value: typeLabel[type] ?? type, inline: true },
    { name: "👥 Entries", value: String(totalEntries), inline: true },
  );

  if (type === "partner" && partnerServer) {
    embed.addFields({ name: "🤝 Partner Server", value: partnerServer, inline: false });
  }

  if (reqs.length) {
    embed.addFields({ name: "📋 Requirements", value: reqs.join("\n"), inline: false });
  }

  if (bonusLines.length) {
    embed.addFields({ name: "✨ Bonus Entries", value: bonusLines.join("\n"), inline: false });
  }

  if (ended && winners.length) {
    embed.addFields({
      name: "🎊 Winners",
      value: winners.map(w => `<@${w}>`).join(", "),
      inline: false,
    });
    embed.setFooter({ text: "Giveaway ended" });
  } else {
    embed.addFields({
      name: "⏰ Ends",
      value: `<t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)`,
      inline: false,
    });
    embed.setFooter({ text: `ID: ${giveaway.id} • Click 🎉 to enter` });
  }

  return embed;
}

export function buildEnterButton(giveawayId: string, entryCount: number, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:enter:${giveawayId}`)
      .setLabel(`Enter Giveaway (${entryCount})`)
      .setEmoji("🎉")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

// ── Update the live embed ─────────────────────────────────────────────────────
export async function updateGiveawayEmbed(client: Client, giveaway: Giveaway): Promise<void> {
  try {
    const channel = await client.channels.fetch(giveaway.channelId) as TextChannel | null;
    if (!channel || !("messages" in channel)) return;
    const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!msg) return;
    await msg.edit({
      embeds: [buildGiveawayEmbed(giveaway)],
      components: [buildEnterButton(giveaway.id, giveaway.entries.length)],
    });
  } catch (err) {
    logger.warn({ err, giveawayId: giveaway.id }, "Failed to update giveaway embed");
  }
}

// ── End a giveaway ────────────────────────────────────────────────────────────
export async function endGiveaway(client: Client, giveaway: Giveaway, reroll = false): Promise<void> {
  const { guildId, channelId, messageId, winnerCount, prize } = giveaway;

  clearTimer(giveaway.id);

  let guild: Guild | null = null;
  try {
    guild = await client.guilds.fetch(guildId);
  } catch { /* guild gone */ }

  // Pick winners with auto-reroll for members who left
  let chosenWinners = pickWinners(giveaway, winnerCount);

  if (guild) {
    const verified: string[] = [];
    for (const wId of chosenWinners) {
      const member = await guild.members.fetch(wId).catch(() => null);
      if (member) {
        verified.push(wId);
      } else {
        // Auto-reroll: pick from remaining entries excluding already used and this one
        const eligible = giveaway.entries
          .map(e => e.userId)
          .filter(uid => !verified.includes(uid) && uid !== wId && !chosenWinners.includes(uid));
        if (eligible.length) {
          const replacement = eligible[Math.floor(Math.random() * eligible.length)];
          verified.push(replacement);
        }
      }
    }
    chosenWinners = verified;
  }

  await updateGiveaway(guildId, giveaway.id, {
    ended: true,
    winners: chosenWinners,
  });

  const updated = getGiveaway(guildId, giveaway.id) ?? { ...giveaway, ended: true, winners: chosenWinners };

  // Edit the original message
  try {
    const channel = await client.channels.fetch(channelId) as TextChannel | null;
    if (channel && "messages" in channel) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [buildGiveawayEmbed(updated, true)],
          components: [buildEnterButton(giveaway.id, updated.entries.length, true)],
        });

        if (chosenWinners.length === 0) {
          await channel.send({
            content: `🎉 **Giveaway ended!**\n\n**Prize:** ${prize}\nNo valid entries — no winners could be selected.`,
          });
        } else {
          const winnersStr = chosenWinners.map(w => `<@${w}>`).join(", ");
          await channel.send({
            content: `🎊 Congratulations ${winnersStr}! You won **${prize}**!\n> [Jump to giveaway](${msg.url})`,
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err, giveawayId: giveaway.id }, "Failed to edit ended giveaway message");
  }

  // DM winners
  for (const wId of chosenWinners) {
    try {
      const user = await client.users.fetch(wId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf0a500)
            .setTitle("🎉 You won a giveaway!")
            .setDescription(`You won **${prize}**!\n\nContact the host to claim your prize.`)
            .setTimestamp(),
        ],
      });
    } catch { /* user has DMs closed */ }
  }

  logger.info({ giveawayId: giveaway.id, winners: chosenWinners, reroll }, "Giveaway ended");
}

// ── Timer management ──────────────────────────────────────────────────────────
function clearTimer(giveawayId: string): void {
  const t = activeTimers.get(giveawayId);
  if (t) {
    clearTimeout(t);
    activeTimers.delete(giveawayId);
  }
}

export function scheduleGiveaway(client: Client, giveaway: Giveaway): void {
  clearTimer(giveaway.id);
  const delay = Math.max(0, giveaway.endsAt - Date.now());

  const timer = setTimeout(async () => {
    const fresh = getGiveawayByMessage(giveaway.messageId) ?? getGiveaway(giveaway.guildId, giveaway.id);
    if (!fresh || fresh.ended || fresh.cancelled) return;
    await endGiveaway(client, fresh);
  }, delay);

  activeTimers.set(giveaway.id, timer);
}

export function cancelTimer(giveawayId: string): void {
  clearTimer(giveawayId);
}

export function scheduleAllGiveaways(client: Client): void {
  const active = getAllActiveGiveaways();
  let scheduled = 0;

  for (const g of active) {
    if (g.endsAt <= Date.now()) {
      // Overdue — end immediately
      endGiveaway(client, g).catch(err =>
        logger.error({ err, giveawayId: g.id }, "Failed to end overdue giveaway")
      );
    } else {
      scheduleGiveaway(client, g);
      scheduled++;
    }
  }

  logger.info({ scheduled, overdue: active.length - scheduled }, "Giveaway timers restored");
}
