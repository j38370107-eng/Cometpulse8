import type { Command } from "../types";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getActiveGiveaways } from "../../store/giveaways";
import { formatDuration } from "../../giveaway/parse";

export const glistCommand: Command = {
  name: "glist",
  aliases: ["giveaways", "activegiveaways", "giveaway-list"],
  description: "List all active giveaways in this server.",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ManageMessages],
  async execute(message) {
    if (!message.guild) return;

    const active = getActiveGiveaways(message.guild.id);
    if (active.length === 0) {
      return message.reply("📭 No active giveaways right now.");
    }

    const fields = active.map((g) => {
      const remaining = Math.max(0, g.endTime - Date.now());
      const entries = g.entries.reduce((s, e) => s + e.entries, 0);
      return {
        name: `🎉 ${g.prize}`,
        value: [
          `Channel: <#${g.channelId}>`,
          `Winners: **${g.winnerCount}**`,
          `Entries: **${g.entries.length}** unique (${entries} weighted)`,
          `Ends: <t:${Math.floor(g.endTime / 1000)}:R>`,
          `ID: \`${g.id}\``,
        ].join(" • "),
        inline: false,
      };
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎰 Active Giveaways — ${active.length}`)
      .setColor(0x7c3cfa)
      .addFields(fields.slice(0, 25));

    return message.channel.send({ embeds: [embed] });
  },
};
