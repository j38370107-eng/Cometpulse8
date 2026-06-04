import type { Command } from "../types";
import { EmbedBuilder } from "discord.js";
import {
  getCountingConfig,
  getCountingState,
  getCountingStats,
} from "../../store/counting";
import { formatCount } from "../../counting/parse";

export const countstatsCommand: Command = {
  name: "countstats",
  aliases: ["cstats", "countingstats"],
  description: "View counting statistics for the server or a user.",
  usage: "[@user]",
  requiredPermissions: [],
  async execute(message, args) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const config = getCountingConfig(guildId);
    const state = getCountingState(guildId);
    const statsMap = getCountingStats(guildId);

    const targetUser = message.mentions.users.first();

    if (targetUser) {
      const s = statsMap.get(targetUser.id);
      const embed = new EmbedBuilder()
        .setTitle(`📊 Counting Stats — ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(0x5865f2)
        .addFields(
          { name: "✅ Contributions", value: String(s?.contributions ?? 0), inline: true },
          { name: "❌ Fails", value: String(s?.fails ?? 0), inline: true },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // Sort contributors
    const topContribs = [...statsMap.values()]
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 3);
    const topFails = [...statsMap.values()]
      .sort((a, b) => b.fails - a.fails)
      .slice(0, 3);

    const contribList = topContribs.length
      ? topContribs.map((s, i) => `${i + 1}. <@${s.userId}> — ${s.contributions}`).join("\n")
      : "No data yet";
    const failList = topFails.length
      ? topFails.map((s, i) => `${i + 1}. <@${s.userId}> — ${s.fails}`).join("\n")
      : "No data yet";

    const channelDisplay = config.channelId ? `<#${config.channelId}>` : "Not set";
    const lastCounterDisplay = state.lastUserId ? `<@${state.lastUserId}>` : "Nobody";
    const lastFailDisplay = state.lastFailUserId ? `<@${state.lastFailUserId}>` : "Nobody";

    const embed = new EmbedBuilder()
      .setTitle(`📊 Counting Stats — ${message.guild.name}`)
      .setColor(0x5865f2)
      .addFields(
        { name: "Current Count", value: formatCount(state.currentCount, config.mode), inline: true },
        { name: "🏆 High Score", value: formatCount(state.highScore, config.mode), inline: true },
        { name: "💥 Total Fails", value: String(state.totalFails), inline: true },
        { name: "Mode", value: config.mode, inline: true },
        { name: "Channel", value: channelDisplay, inline: true },
        { name: "Last Counter", value: lastCounterDisplay, inline: true },
        { name: "Last to Ruin It", value: lastFailDisplay, inline: true },
        { name: "🥇 Top Contributors", value: contribList, inline: false },
        { name: "💀 Most Fails", value: failList, inline: false },
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
