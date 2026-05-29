import type { Command } from "../types";
import { AttachmentBuilder } from "discord.js";
import {
  getUserLevel,
  getUserRank,
  getLevelConfig,
  xpForLevel,
  xpInCurrentLevel,
} from "../../store/levels";
import { generateRankCard } from "../../lib/rankCard";

export const rankCommand: Command = {
  name: "rank",
  aliases: ["level", "lvl", "r"],
  description: "Show your rank card, or another user's.",
  usage: "[@user]",
  async execute(message, args) {
    if (!message.guild) return;

    const target =
      message.mentions.users.first() ??
      (args[0]
        ? await message.guild.members.fetch(args[0]).then((m) => m?.user).catch(() => null)
        : null) ??
      message.author;

    if (target.bot && target.id !== message.client.user?.id) {
      return message.reply("❌ Bots don't earn XP.");
    }

    const config = getLevelConfig(message.guild.id);
    if (!config.enabled) {
      return message.reply("❌ The leveling system is disabled in this server.");
    }

    const userData = getUserLevel(message.guild.id, target.id);
    const rank = getUserRank(message.guild.id, target.id);
    const levelXpNeeded = xpForLevel(userData.level);
    const currentLevelXp = xpInCurrentLevel(userData.xp);

    const loading = await message.channel.send("⏳ Generating rank card...");

    try {
      const avatarUrl = target.displayAvatarURL({ extension: "png", size: 256 });
      const handle = target.username;
      const displayName =
        message.guild.members.cache.get(target.id)?.displayName ?? target.username;

      const buf = await generateRankCard({
        username: displayName,
        handle,
        avatarUrl,
        level: userData.level,
        currentLevelXp,
        levelXpNeeded,
        totalXp: userData.xp,
        rank,
      });

      const attachment = new AttachmentBuilder(buf, { name: "rank.png" });
      await loading.delete().catch(() => {});
      return message.channel.send({ files: [attachment] });
    } catch (err) {
      await loading.delete().catch(() => {});
      return message.reply("❌ Failed to generate rank card.");
    }
  },
};
