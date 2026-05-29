import { EmbedBuilder, Message, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { setUserLevel, resetUserLevel, totalXpForLevel, getLevelConfig } from "../store/levels";

export const setLevelCommand: Command = {
  name: "setlevel",
  aliases: ["setxp"],
  description: "Set a user's level. Use 0 to reset.",
  usage: "setlevel <@user> <level>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    const config = getLevelConfig(message.guild!.id);
    if (!config.enabled) {
      return message.reply("❌ Leveling is disabled in this server.").catch(() => {});
    }

    const target =
      message.mentions.members?.first()?.user ??
      (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);

    if (!target) {
      return message
        .reply(`❌ Please mention a user. Usage: \`${message.content.split(" ")[0]} @user <level>\``)
        .catch(() => {});
    }

    if (target.bot) {
      return message.reply("❌ Bots can't have levels.").catch(() => {});
    }

    const rawLevel = args[1] ?? args[0];
    const level = parseInt(rawLevel ?? "", 10);
    if (isNaN(level) || level < 0 || level > 1000) {
      return message
        .reply("❌ Please provide a valid level between 0 and 1000.")
        .catch(() => {});
    }

    const guildId = message.guild!.id;

    if (level === 0) {
      resetUserLevel(guildId, target.id);
      return message
        .reply(`✅ Reset <@${target.id}>'s level and XP to 0.`)
        .catch(() => {});
    }

    const xp = totalXpForLevel(level);
    setUserLevel(guildId, target.id, { xp, level });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ Set <@${target.id}>'s level to **${level}** (${xp} total XP).`);

    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
