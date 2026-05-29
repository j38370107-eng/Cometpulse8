import type { Command } from "../types";
import { PermissionFlagsBits } from "discord.js";
import { setUserLevel, totalXpForLevel } from "../../store/levels";

export const setLevelCommand: Command = {
  name: "setlevel",
  aliases: ["sl", "forcelevel"],
  description: "Set a user's level directly. (Admin only)",
  usage: "@user <level>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;

    const target = message.mentions.users.first();
    if (!target) return message.reply("❌ Please mention a user. Usage: `setlevel @user <level>`");

    const level = parseInt(args[1] ?? args[0] ?? "");
    if (isNaN(level) || level < 0) {
      return message.reply("❌ Please provide a valid level (0 or higher).");
    }

    const xp = totalXpForLevel(level);
    setUserLevel(message.guild.id, target.id, { xp, level });
    return message.reply(
      `✅ Set <@${target.id}>'s level to **${level}** (${xp.toLocaleString()} XP).`,
    );
  },
};
