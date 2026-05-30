import type { Command } from "../types";
import { EmbedBuilder } from "discord.js";
import { getInviteStats, getInviterForUser } from "../../store/invites";

export const invitesCommand: Command = {
  name: "invites",
  aliases: ["invite", "inviters"],
  description: "Check how many invites a user has.",
  usage: "[@user]",
  async execute(message, args) {
    if (!message.guild) return;

    const target =
      message.mentions.users.first() ??
      (args[0] ? await message.guild.members.fetch(args[0]).then((m) => m.user).catch(() => null) : null) ??
      message.author;

    const guildId = message.guild.id;
    const stats = getInviteStats(guildId, target.id);

    const embed = new EmbedBuilder()
      .setColor(0x7c3cfa)
      .setTitle(`Invite Stats — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL());

    if (!stats) {
      embed.setDescription("No invite data found for this user.");
    } else {
      const real = Math.max(0, stats.count - (stats.fakeCount ?? 0));
      embed.addFields(
        { name: "Total invites", value: String(stats.count), inline: true },
        { name: "Fake/left", value: String(stats.fakeCount ?? 0), inline: true },
        { name: "Real invites", value: String(real), inline: true },
        { name: "Members invited", value: stats.invitedUsers.length > 0 ? stats.invitedUsers.map((id) => `<@${id}>`).join(", ").slice(0, 1000) : "None", inline: false },
      );
    }

    return message.channel.send({ embeds: [embed] });
  },
};

export const whoinvitedCommand: Command = {
  name: "whoinvited",
  aliases: ["invitedby"],
  description: "Check who invited a member to the server.",
  usage: "[@user]",
  async execute(message, args) {
    if (!message.guild) return;

    const target =
      message.mentions.users.first() ??
      (args[0] ? await message.guild.members.fetch(args[0]).then((m) => m.user).catch(() => null) : null) ??
      message.author;

    const inviter = getInviterForUser(message.guild.id, target.id);

    if (!inviter) {
      return message.reply(`❓ No invite data found for **${target.tag}**. They may have joined before invite tracking was active.`);
    }

    return message.reply(`📨 **${target.tag}** was invited by <@${inviter.inviterId}> (**${inviter.inviterTag}**).`);
  },
};
