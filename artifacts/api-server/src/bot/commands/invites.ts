import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { resolveTarget } from "../lib/resolveUser";
import { getInviteStats, getInviteLeaderboard } from "../store/invites";

export const invitesCommand: Command = {
  name: "invites",
  aliases: ["inv"],
  description: "Check how many members a user has invited",
  usage: "[@user | userID]",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const isLb =
      args[0]?.toLowerCase() === "leaderboard" ||
      args[0]?.toLowerCase() === "lb";
    if (isLb) {
      return showLeaderboard(message);
    }

    let target = message.author;
    if (args[0]) {
      const resolved = await resolveTarget(message, args);
      if (!resolved) return message.reply(usageErr(message, invitesCommand, "Could not find that user"));
      target = resolved.user;
    }

    const stats = getInviteStats(message.guild.id, target.id);
    if (!stats) {
      return message.reply(
        `**${target.tag}** has no recorded invites in this server.`,
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Invites — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Total Invites", value: `${stats.count}`, inline: true },
        {
          name: "Members Invited",
          value: `${stats.invitedUsers.length}`,
          inline: true,
        },
      )
      .setTimestamp();

    if (stats.invitedUsers.length > 0) {
      const preview = stats.invitedUsers
        .slice(0, 15)
        .map((id) => `<@${id}>`)
        .join(", ");
      const extra =
        stats.invitedUsers.length > 15
          ? ` … +${stats.invitedUsers.length - 15} more`
          : "";
      embed.addFields({ name: "Invited Members", value: preview + extra });
    }

    await message.reply({ embeds: [embed] });
  },
};

export const inviteLeaderboardCommand: Command = {
  name: "inviteleaderboard",
  aliases: ["invlb", "invitetop"],
  description: "Show the server invite leaderboard",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message) {
    if (!message.guild) return;
    await showLeaderboard(message);
  },
};

async function showLeaderboard(message: Message): Promise<void> {
  if (!message.guild) return;
  const lb = getInviteLeaderboard(message.guild.id).slice(0, 10);
  if (!lb.length) {
    await message.reply("No invite data recorded yet.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🏆 Invite Leaderboard — ${message.guild.name}`)
    .setDescription(
      lb
        .map(
          (r, i) =>
            `**${i + 1}.** <@${r.inviterId}> — **${r.count}** invite${r.count === 1 ? "" : "s"}`,
        )
        .join("\n"),
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
