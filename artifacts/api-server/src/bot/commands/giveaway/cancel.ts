import type { Command } from "../types";
import { PermissionFlagsBits, TextChannel } from "discord.js";
import {
  getGiveaway,
  getGiveawayByMessageId,
  getGiveawayConfig,
  saveGiveaway,
} from "../../store/giveaways";
import { cancelTimer, buildGiveawayEmbed, buildGiveawayRow } from "../../giveaway/manager";

function canRunGiveaway(message: any): boolean {
  if (!message.guild) return false;
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  const config = getGiveawayConfig(message.guild.id);
  return config.managerRoles.length > 0 && config.managerRoles.some((r: string) => member.roles.cache.has(r));
}

export const gcancelCommand: Command = {
  name: "gcancel",
  aliases: ["cancelgiveaway", "giveaway-cancel"],
  description: "Cancel an active giveaway without picking a winner.",
  usage: "<message-id or giveaway-id>",
  requiredPermissions: [PermissionFlagsBits.ManageMessages],
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
    if (giveaway.ended) return message.reply("❌ That giveaway already ended.");
    if (giveaway.cancelled) return message.reply("❌ That giveaway is already cancelled.");

    cancelTimer(giveaway);
    const updated = { ...giveaway, cancelled: true, ended: true };
    saveGiveaway(updated);

    try {
      const ch = await message.client.channels.fetch(giveaway.channelId).catch(() => null);
      if (ch?.isTextBased()) {
        const msg = await (ch as TextChannel).messages.fetch(giveaway.messageId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [buildGiveawayEmbed(updated, true)],
            components: [buildGiveawayRow(updated, true)],
          });
        }
      }
    } catch {}

    return message.reply(`✅ Giveaway for **${giveaway.prize}** has been cancelled.`);
  },
};
