import type { Command } from "../types";
import { EmbedBuilder, PermissionFlagsBits, TextChannel } from "discord.js";
import { parseDuration, parseFlags } from "../../giveaway/parse";
import {
  saveGiveaway,
  getGiveawayConfig,
  Giveaway,
  GiveawayType,
} from "../../store/giveaways";
import {
  buildGiveawayEmbed,
  buildGiveawayRow,
  scheduleEnd,
} from "../../giveaway/manager";
import { getPrefix } from "../../store/prefixes";

function canRunGiveaway(message: any): boolean {
  if (!message.guild) return false;
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const config = getGiveawayConfig(message.guild.id);
  if (config.managerRoles.length > 0) {
    return config.managerRoles.some((r: string) =>
      member.roles.cache.has(r)
    );
  }
  return false;
}

export const gstartCommand: Command = {
  name: "gstart",
  aliases: ["giveaway-start", "gcreate"],
  description: "Start a giveaway.",
  usage: "<duration> <winners> <prize...> [--requirerole @role] [--blackrole @role] [--bonusrole @role:N] [--levelbonus level:bonus] [--mindays N] [--minlevel N] [--booster N] [--channel #channel] [--announce #channel] [--type normal|role-locked|level-gated|partner] [--partner Name]",
  requiredPermissions: [],
  async execute(message, args) {
    if (!message.guild) return;
    if (!canRunGiveaway(message)) {
      return message.reply("❌ You need **Manage Server** permission (or a giveaway manager role) to start giveaways.");
    }

    if (args.length < 3) {
      const prefix = getPrefix(message.guild.id);
      return message.reply(
        `❌ Usage: \`${prefix}gstart <duration> <winners> <prize>\`\n**Example:** \`${prefix}gstart 1h 1 Discord Nitro\`\n\nOptional flags: \`--minlevel 5\` \`--requirerole @Role\` \`--blackrole @Role\` \`--bonusrole @Role:2\` \`--mindays 7\` \`--booster 1\` \`--channel #channel\` \`--announce #channel\``
      );
    }

    const durationMs = parseDuration(args[0]);
    if (!durationMs || durationMs < 10_000) {
      return message.reply("❌ Invalid duration. Examples: `1h`, `30m`, `2d`, `1h30m`");
    }
    if (durationMs > 30 * 86_400_000) {
      return message.reply("❌ Duration cannot exceed 30 days.");
    }

    const winnerCount = parseInt(args[1], 10);
    if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 20) {
      return message.reply("❌ Winner count must be between 1 and 20.");
    }

    const flags = parseFlags(args.slice(2));
    const prize = flags.rest.join(" ").trim();
    if (!prize) {
      return message.reply("❌ You must specify a prize name.");
    }

    const guildId = message.guild.id;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const endTime = Date.now() + durationMs;

    let channelId = message.channel.id;
    if (flags.channel) {
      const resolved = message.guild.channels.cache.get(flags.channel);
      if (resolved?.isTextBased()) channelId = resolved.id;
    }

    const validTypes: GiveawayType[] = ["normal", "role-locked", "level-gated", "partner"];
    const type: GiveawayType = (validTypes.includes(flags.type as GiveawayType)
      ? flags.type
      : "normal") as GiveawayType;

    const giveaway: Giveaway = {
      id,
      guildId,
      channelId,
      messageId: "",
      prize,
      hostId: message.author.id,
      winnerCount,
      endTime,
      ended: false,
      cancelled: false,
      type,
      requirements: {
        requiredRoles: flags.requireRoles,
        blacklistRoles: flags.blackRoles,
        minDays: flags.minDays,
        minLevel: flags.minLevel,
      },
      bonusRoles: flags.bonusRoles,
      levelBonuses: flags.levelBonuses,
      boosterBonus: flags.boosterBonus,
      entries: [],
      winners: [],
      announcementChannelId: flags.announcementChannel,
      partnerInfo: flags.partnerName ? { serverId: "", serverName: flags.partnerName } : null,
    };

    const targetChannel =
      channelId === message.channel.id
        ? (message.channel as TextChannel)
        : (message.guild.channels.cache.get(channelId) as TextChannel | undefined);

    if (!targetChannel) {
      return message.reply("❌ Target channel not found.");
    }

    const msg = await targetChannel.send({
      embeds: [buildGiveawayEmbed(giveaway)],
      components: [buildGiveawayRow(giveaway)],
    });

    giveaway.messageId = msg.id;
    saveGiveaway(giveaway);
    scheduleEnd(giveaway);

    if (channelId !== message.channel.id) {
      await message.reply(`✅ Giveaway started in <#${channelId}>!`);
    }
  },
};
