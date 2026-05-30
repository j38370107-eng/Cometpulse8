import type { Command } from "../types";
import { PermissionFlagsBits } from "discord.js";
import {
  getGiveaway,
  getGiveawayByMessageId,
  getGiveawayConfig,
  saveGiveaway,
} from "../../store/giveaways";
import { updateGiveawayMessage } from "../../giveaway/manager";

function canRunGiveaway(message: any): boolean {
  if (!message.guild) return false;
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  const config = getGiveawayConfig(message.guild.id);
  return config.managerRoles.length > 0 && config.managerRoles.some((r: string) => member.roles.cache.has(r));
}

export const gbonusCommand: Command = {
  name: "gbonus",
  aliases: ["giveaway-bonus", "gaddentries"],
  description: "Manually give a user bonus entries in an active giveaway.",
  usage: "<message-id or giveaway-id> <@user> <entries>",
  requiredPermissions: [PermissionFlagsBits.ManageMessages],
  async execute(message, args) {
    if (!message.guild) return;
    if (!canRunGiveaway(message)) {
      return message.reply("❌ You need **Manage Server** permission (or a giveaway manager role).");
    }

    if (args.length < 3) {
      return message.reply("❌ Usage: `gbonus <giveaway-id> <@user> <entries>`");
    }

    const ref = args[0];
    const guildId = message.guild.id;
    const giveaway =
      getGiveawayByMessageId(guildId, ref) ??
      getGiveaway(guildId, ref);

    if (!giveaway) return message.reply("❌ Giveaway not found.");
    if (giveaway.ended || giveaway.cancelled) return message.reply("❌ That giveaway is no longer active.");

    const targetUser =
      message.mentions.users.first() ??
      (args[1] ? await message.guild.members.fetch(args[1]).then((m) => m?.user).catch(() => null) : null);

    if (!targetUser) return message.reply("❌ User not found.");

    const bonus = parseInt(args[2], 10);
    if (isNaN(bonus) || bonus < 1) return message.reply("❌ Bonus must be a positive number.");

    const entries = [...giveaway.entries];
    const existing = entries.find((e) => e.userId === targetUser.id);
    if (existing) {
      existing.entries += bonus;
    } else {
      entries.push({ userId: targetUser.id, entries: 1 + bonus });
    }

    const updated = { ...giveaway, entries };
    saveGiveaway(updated);
    await updateGiveawayMessage(updated);

    const total = entries.find((e) => e.userId === targetUser.id)?.entries ?? bonus;
    return message.reply(
      `✅ Gave **${bonus}** bonus entries to ${targetUser.tag}. They now have **${total}** total entries in **${giveaway.prize}**.`
    );
  },
};
