import type { Command } from "./types";
import { setPrefix } from "../store/prefixes";

export const changePrefixCommand: Command = {
  name: "changeprefix",
  aliases: ["prefix", "setprefix"],
  description: "Change the bot's command prefix for this server.",
  usage: "<newprefix>",
  requiredPermissions: ["ManageGuild"],
  async execute(message, args) {
    if (!message.guild) return;
    const newPrefix = args[0];
    if (!newPrefix) {
      return message.reply("Please provide a new prefix. Example: `c!changeprefix !`");
    }
    if (newPrefix.length > 5) {
      return message.reply("Prefix must be 5 characters or fewer.");
    }
    setPrefix(message.guild.id, newPrefix);
    return message.reply(`✅ Prefix changed to \`${newPrefix}\``);
  },
};
