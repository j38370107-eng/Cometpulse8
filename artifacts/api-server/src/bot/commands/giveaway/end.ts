import type { Command } from "../types";
import { PermissionFlagsBits } from "discord.js";
import {
  getGiveaway,
  getGiveawayByMessageId,
  getGiveawayConfig,
} from "../../store/giveaways";
import { endGiveaway } from "../../giveaway/manager";

function canRunGiveaway(message: any): boolean {
  if (!message.guild) return false;
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const config = getGiveawayConfig(message.guild.id);
  return config.managerRoles.length > 0 && config.managerRoles.some((r: string) => member.roles.cache.has(r));
}

export const gendCommand: Command = {
  name: "gend",
  aliases: ["giveaway-end", "endgiveaway"],
  description: "Force-end an active giveaway early.",
  usage: "<message-id or giveaway-id>",
  async execute(message, args) {
    if (!message.guild) return;
    if (!canRunGiveaway(message)) {
      return message.reply("❌ You need **Manage Server** permission (or a giveaway manager role).");
    }

    const ref = args[0];
    if (!ref) return message.reply("❌ Provide the giveaway message ID or ID.");

    const guildId = message.guild.id;
    let giveaway =
      getGiveawayByMessageId(guildId, ref) ??
      getGiveaway(guildId, ref);

    if (!giveaway) return message.reply("❌ Giveaway not found.");
    if (giveaway.ended) return message.reply("❌ That giveaway has already ended.");
    if (giveaway.cancelled) return message.reply("❌ That giveaway was cancelled.");

    const msg = await message.reply("⏳ Ending giveaway…");
    const result = await endGiveaway(guildId, giveaway.id);
    if (!result) return msg.edit("❌ Failed to end giveaway.");

    if (result.winners.length > 0) {
      await msg.edit(`✅ Giveaway ended! Winner${result.winners.length > 1 ? "s" : ""}: ${result.winners.map((w) => `<@${w}>`).join(", ")}`);
    } else {
      await msg.edit("✅ Giveaway ended — no valid entries.");
    }
  },
};
