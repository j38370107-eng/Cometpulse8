import { EmbedBuilder, Message, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import {
  getUserLevel,
  getUserRank,
  xpForLevel,
  getLevelConfig,
} from "../store/levels";

export const rankCommand: Command = {
  name: "rank",
  aliases: ["level", "xp"],
  description: "Shows your current level and XP.",
  usage: "rank [@user]",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    const config = getLevelConfig(message.guild!.id);
    if (!config.enabled) {
      return message.reply("❌ Leveling is disabled in this server.").catch(() => {});
    }

    const target =
      message.mentions.members?.first()?.user ??
      (args[0]
        ? await message.client.users.fetch(args[0]).catch(() => null)
        : null) ??
      message.author;

    if (target.bot) {
      return message.reply("❌ Bots don't have levels.").catch(() => {});
    }

    const guildId = message.guild!.id;
    const data = getUserLevel(guildId, target.id);
    const rank = getUserRank(guildId, target.id);
    const xpNeeded = xpForLevel(data.level);
    const xpProgress = data.xp - (() => {
      let total = 0;
      for (let i = 0; i < data.level; i++) total += xpForLevel(i);
      return total;
    })();

    const barLength = 20;
    const filled = Math.round((xpProgress / xpNeeded) * barLength);
    const bar =
      "█".repeat(filled) + "░".repeat(Math.max(0, barLength - filled));

    const member = await message.guild!.members.fetch(target.id).catch(() => null);
    const displayName = member?.displayName ?? target.username;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: `${displayName}'s Rank`,
        iconURL: target.displayAvatarURL(),
      })
      .addFields(
        { name: "🏅 Rank", value: `#${rank}`, inline: true },
        { name: "⭐ Level", value: String(data.level), inline: true },
        { name: "✨ Total XP", value: String(data.xp), inline: true },
        {
          name: `Progress to Level ${data.level + 1}`,
          value: `\`${bar}\`\n${xpProgress} / ${xpNeeded} XP`,
        },
      )
      .setFooter({ text: `${xpNeeded - xpProgress} XP needed for level ${data.level + 1}` });

    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
