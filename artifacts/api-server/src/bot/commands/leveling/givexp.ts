import type { Command } from "../types";
import { PermissionFlagsBits } from "discord.js";
import { getUserLevel, setUserLevel, levelFromXp } from "../../store/levels";

export const giveXpCommand: Command = {
  name: "givexp",
  aliases: ["addxp", "gxp"],
  description: "Give XP to a user. (Admin only)",
  usage: "@user <amount>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;

    const target = message.mentions.users.first();
    if (!target) return message.reply("❌ Please mention a user. Usage: `givexp @user <amount>`");

    const amount = parseInt(args[1] ?? args[0] ?? "");
    if (isNaN(amount) || amount === 0) {
      return message.reply("❌ Please provide a non-zero XP amount (can be negative to deduct).");
    }

    const current = getUserLevel(message.guild.id, target.id);
    const newXp = Math.max(0, current.xp + amount);
    const newLevel = levelFromXp(newXp);
    setUserLevel(message.guild.id, target.id, { xp: newXp, level: newLevel });

    const verb = amount > 0 ? "Gave" : "Deducted";
    const prep = amount > 0 ? "to" : "from";
    return message.reply(
      `✅ ${verb} **${Math.abs(amount).toLocaleString()} XP** ${prep} <@${target.id}>. They now have **${newXp.toLocaleString()} XP** (Level **${newLevel}**).`,
    );
  },
};
