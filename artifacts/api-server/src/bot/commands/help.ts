import { EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { getPrefix } from "../store/prefixes";

export const helpCommand: Command = {
  name: "help",
  aliases: ["h", "commands"],
  description: "Show all available commands.",
  usage: "",
  async execute(message, _args) {
    const guildId = message.guild?.id ?? "";
    const prefix = getPrefix(guildId);

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("⚡ CometPulse — Commands")
      .setDescription(`My prefix is \`${prefix}\`\nUse \`${prefix}changeprefix <new>\` to change it.`)
      .addFields(
        {
          name: "⚙️ General",
          value: [
            `\`${prefix}help\` — Show this message`,
            `\`${prefix}changeprefix <prefix>\` — Change the bot prefix`,
          ].join("\n"),
        },
      )
      .setFooter({ text: "CometPulse · Advanced Discord Utility Bot" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
