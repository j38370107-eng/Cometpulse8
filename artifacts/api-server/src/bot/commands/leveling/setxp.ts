import type { Command } from "../types";
import { PermissionFlagsBits } from "discord.js";
import { setUserLevel, levelFromXp } from "../../store/levels";

export const setXpCommand: Command = {
  name: "setxp",
  aliases: ["forcexp"],
  description: "Set a user's total XP. (Admin only)",
  usage: "@user <amount>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;

    const target = message.mentions.users.first();
    if (!target) return message.reply("❌ Please mention a user. Usage: `setxp @user <amount>`");

    const amount = parseInt(args[1] ?? args[0] ?? "");
    if (isNaN(amount) || amount < 0) {
      return message.reply("❌ Please provide a valid non-negative XP amount.");
    }

    const level = levelFromXp(amount);
    setUserLevel(message.guild.id, target.id, { xp: amount, level });
    return message.reply(
      `✅ Set <@${target.id}>'s XP to **${amount.toLocaleString()}** (Level **${level}**).`,
    );
  },
};
