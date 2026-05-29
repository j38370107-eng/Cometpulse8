import { EmbedBuilder, Message } from "discord.js";
import type { Command } from "./types";
import { getLeaderboard, getLevelConfig } from "../store/levels";

const MEDALS = ["🥇", "🥈", "🥉"];

export const leaderboardCommand: Command = {
  name: "leaderboard",
  aliases: ["lb", "levels", "top"],
  description: "Shows the top 10 members by XP.",
  usage: "leaderboard",
  requiredPermissions: [],

  async execute(message: Message, _args: string[]) {
    const config = getLevelConfig(message.guild!.id);
    if (!config.enabled) {
      return message.reply("❌ Leveling is disabled in this server.").catch(() => {});
    }

    const guildId = message.guild!.id;
    const entries = getLeaderboard(guildId, 10);

    if (entries.length === 0) {
      return message
        .reply("📊 No one has earned XP yet. Start chatting!")
        .catch(() => {});
    }

    const lines: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const { userId, xp, level } = entries[i]!;
      const member = await message.guild!.members.fetch(userId).catch(() => null);
      const name = member?.displayName ?? `<@${userId}>`;
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      lines.push(`${medal} ${name} — Level **${level}** · ${xp} XP`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏆 ${message.guild!.name} Leaderboard`)
      .setDescription(lines.join("\n"))
      .setFooter({ text: "XP is earned by chatting (1 min cooldown between gains)" });

    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
