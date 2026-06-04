import type { Command } from "../types";
import { EmbedBuilder } from "discord.js";
import { getCountingStats } from "../../store/counting";

const MEDALS = ["🥇", "🥈", "🥉"];

export const countleaderboardCommand: Command = {
  name: "countleaderboard",
  aliases: ["countlb", "clb", "countinglb"],
  description: "View the counting leaderboard.",
  usage: "[contributions|fails]",
  requiredPermissions: [],
  async execute(message, args) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const statsMap = getCountingStats(guildId);
    const type = args[0]?.toLowerCase() === "fails" ? "fails" : "contributions";

    const sorted = [...statsMap.values()]
      .sort((a, b) => (type === "fails" ? b.fails - a.fails : b.contributions - a.contributions))
      .slice(0, 10);

    if (sorted.length === 0) {
      return message.reply("📊 No counting data yet. Start counting!");
    }

    const rows = sorted.map((s, i) => {
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      const val = type === "fails" ? s.fails : s.contributions;
      return `${medal} <@${s.userId}> — **${val}** ${type === "fails" ? "fails" : "counts"}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(type === "fails" ? "💀 Counting Fail Leaderboard" : "🏆 Counting Leaderboard")
      .setDescription(rows.join("\n"))
      .setColor(type === "fails" ? 0xed4245 : 0xf4c430)
      .setFooter({ text: `Use countleaderboard fails to see fail leaderboard` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
