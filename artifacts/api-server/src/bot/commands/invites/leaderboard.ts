import type { Command } from "../types";
import { EmbedBuilder } from "discord.js";
import { getInviteLeaderboard } from "../../store/invites";

export const inviteLeaderboardCommand: Command = {
  name: "inviteleaderboard",
  aliases: ["invitelb", "invitetop"],
  description: "Show the top inviters in this server.",
  usage: "",
  async execute(message) {
    if (!message.guild) return;

    const lb = getInviteLeaderboard(message.guild.id).slice(0, 10);

    if (lb.length === 0) {
      return message.reply("📭 No invite data recorded yet.");
    }

    const medals = ["🥇", "🥈", "🥉"];
    const lines = lb.map((r, i) => {
      const real = Math.max(0, r.count - (r.fakeCount ?? 0));
      const medal = medals[i] ?? `**${i + 1}.**`;
      return `${medal} <@${r.inviterId}> — **${real}** real (**${r.count}** total, **${r.fakeCount ?? 0}** fake)`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x7c3cfa)
      .setTitle(`📨 Invite Leaderboard — ${message.guild.name}`)
      .setDescription(lines.join("\n"));

    return message.channel.send({ embeds: [embed] });
  },
};
