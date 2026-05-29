import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { setServerLogChannel } from "../store/serverlog";

export const setServerLogsCommand: Command = {
  name: "setserverlogs",
  aliases: ["serverlogs", "serverlogchannel"],
  description: "Set the channel where server activity logs are posted",
  usage: "<#channel>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const channel =
      message.mentions.channels.first() ??
      (args[0] ? message.guild.channels.cache.get(args[0]) : null);

    if (!channel || !("send" in channel)) {
      return message.reply(usageErr(message, setServerLogsCommand, "Mention a valid text channel"));
    }

    setServerLogChannel(message.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Server Log Channel Set")
      .setDescription(`Server activity logs will now be posted in <#${channel.id}>.`)
      .addFields({
        name: "What gets logged",
        value: [
          "📝 Messages edited & deleted",
          "👤 Members joined & left",
          "🔨 Bans & unbans",
          "🏷️ Nickname & role changes",
          "📢 Channels created, deleted & updated",
          "🎭 Roles created, deleted & updated",
          "🔊 Voice channel joins, leaves & moves",
        ].join("\n"),
      })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
