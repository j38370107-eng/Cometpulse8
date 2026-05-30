import type { Command } from "../types";
import { PermissionFlagsBits, TextChannel } from "discord.js";
import {
  getGiveaway,
  getGiveawayByMessageId,
  getGiveawayConfig,
} from "../../store/giveaways";
import { rerollGiveaway } from "../../giveaway/manager";
import { getPrefix } from "../../store/prefixes";

function canRunGiveaway(message: any): boolean {
  if (!message.guild) return false;
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const config = getGiveawayConfig(message.guild.id);
  return config.managerRoles.length > 0 && config.managerRoles.some((r: string) => member.roles.cache.has(r));
}

export const grerollCommand: Command = {
  name: "greroll",
  aliases: ["giveaway-reroll", "rerollgiveaway"],
  description: "Reroll winner(s) for an ended giveaway.",
  usage: "<message-id or giveaway-id> [winner-count]",
  async execute(message, args) {
    if (!message.guild) return;
    if (!canRunGiveaway(message)) {
      return message.reply("❌ You need **Manage Server** permission (or a giveaway manager role).");
    }

    const ref = args[0];
    if (!ref) return message.reply("❌ Provide the giveaway message ID or ID.");

    const guildId = message.guild.id;
    const giveaway =
      getGiveawayByMessageId(guildId, ref) ??
      getGiveaway(guildId, ref);

    if (!giveaway) return message.reply("❌ Giveaway not found.");
    if (!giveaway.ended) {
      const prefix = getPrefix(message.guild!.id);
      return message.reply(`❌ That giveaway hasn't ended yet. Use \`${prefix}gend\` first.`);
    }
    if (giveaway.cancelled) return message.reply("❌ That giveaway was cancelled.");
    if (giveaway.entries.length === 0) return message.reply("❌ No entries to reroll from.");

    const count = args[1] ? Math.max(1, parseInt(args[1], 10) || 1) : undefined;
    const msg = await message.reply("🔄 Rerolling…");
    const newWinners = await rerollGiveaway(guildId, giveaway.id, count);

    if (newWinners.length === 0) {
      return msg.edit("❌ No valid winners found (all may have left the server).");
    }

    const mentions = newWinners.map((w) => `<@${w}>`).join(", ");
    await msg.edit(`🎉 New winner${newWinners.length > 1 ? "s" : ""}: ${mentions}`);

    const ch = await message.client.channels.fetch(giveaway.channelId).catch(() => null);
    if (ch?.isTextBased() && ch.id !== message.channel.id) {
      await (ch as TextChannel).send(`🔄 **Reroll!** New winner${newWinners.length > 1 ? "s" : ""} for **${giveaway.prize}**: ${mentions}`);
    }
  },
};
