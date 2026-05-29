import type { Command } from "../types";
import { PermissionFlagsBits } from "discord.js";
import { resetUserLevel, resetGuildLevels } from "../../store/levels";

export const resetXpCommand: Command = {
  name: "resetxp",
  aliases: ["rlevel", "resetlevel"],
  description: "Reset a user's XP, or reset all XP in the server. (Admin only)",
  usage: "@user | all",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;

    if (args[0]?.toLowerCase() === "all") {
      const count = resetGuildLevels(message.guild.id);
      return message.reply(
        `✅ Reset XP for **${count}** user${count !== 1 ? "s" : ""} in this server.`,
      );
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply(
        "❌ Please mention a user, or use `resetxp all` to reset everyone.\nUsage: `resetxp @user`",
      );
    }

    resetUserLevel(message.guild.id, target.id);
    return message.reply(`✅ Reset XP for <@${target.id}>.`);
  },
};
