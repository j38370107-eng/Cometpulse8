import type { Command } from "../types";
import { EmbedBuilder } from "discord.js";
import { getLeaderboard, getLevelConfig, getUserRank } from "../../store/levels";

export const leaderboardCommand: Command = {
  name: "leaderboard",
  aliases: ["lb", "top", "levels"],
  description: "Show the top XP earners in this server.",
  usage: "[page]",
  async execute(message, args) {
    if (!message.guild) return;

    const config = getLevelConfig(message.guild.id);
    if (!config.enabled) {
      return message.reply("❌ The leveling system is disabled in this server.");
    }

    const page = Math.max(1, parseInt(args[0] ?? "1") || 1);
    const pageSize = 10;
    const top = getLeaderboard(message.guild.id, page * pageSize);
    const slice = top.slice((page - 1) * pageSize, page * pageSize);

    if (slice.length === 0) {
      return message.reply(
        page > 1
          ? "❌ No more users on this page."
          : "❌ No one has earned XP yet!",
      );
    }

    const medals = ["🥇", "🥈", "🥉"];
    const lines = await Promise.all(
      slice.map(async (entry, i) => {
        const globalRank = (page - 1) * pageSize + i + 1;
        const medal = medals[globalRank - 1] ?? `**#${globalRank}**`;
        let name: string;
        try {
          const member = await message.guild!.members.fetch(entry.userId).catch(() => null);
          name = member?.displayName ?? `<@${entry.userId}>`;
        } catch {
          name = `<@${entry.userId}>`;
        }
        return `${medal} ${name} — **Level ${entry.level}** · ${entry.xp.toLocaleString()} XP`;
      }),
    );

    const myRank = getUserRank(message.guild.id, message.author.id);
    const embed = new EmbedBuilder()
      .setTitle(`🏆 Leaderboard — ${message.guild.name}`)
      .setDescription(lines.join("\n"))
      .setColor(0x7c3cfa)
      .setFooter({
        text: `Page ${page} • Your rank: #${myRank}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  },
};
