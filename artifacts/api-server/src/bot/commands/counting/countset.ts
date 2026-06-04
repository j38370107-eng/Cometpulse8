import type { Command } from "../types";
import { PermissionFlagsBits, TextChannel } from "discord.js";
import { setCountingConfig, getCountingConfig } from "../../store/counting";
import { getPrefix } from "../../store/prefixes";

export const countsetCommand: Command = {
  name: "countset",
  aliases: ["setcounting", "countingset"],
  description: "Set the counting channel for this server.",
  usage: "<#channel>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;

    const channel =
      message.mentions.channels.first() ??
      (args[0] ? message.guild.channels.cache.get(args[0]) : null);

    if (!channel || !(channel instanceof TextChannel)) {
      const prefix = getPrefix(message.guild.id);
      return message.reply(`❌ Please mention a valid text channel. Usage: \`${prefix}countset #channel\``);
    }

    await setCountingConfig(message.guild.id, { channelId: channel.id });
    return message.reply(`✅ Counting channel set to ${channel}! Start counting from **1**.`);
  },
};

export const countdisableCommand: Command = {
  name: "countdisable",
  aliases: ["disablecounting"],
  description: "Disable the counting channel.",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message) {
    if (!message.guild) return;
    const cfg = getCountingConfig(message.guild.id);
    if (!cfg.channelId) return message.reply("❌ Counting is not enabled.");
    await setCountingConfig(message.guild.id, { channelId: null });
    return message.reply("✅ Counting has been disabled.");
  },
};
