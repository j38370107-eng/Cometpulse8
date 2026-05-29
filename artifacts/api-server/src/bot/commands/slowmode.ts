import { Message, PermissionFlagsBits, TextChannel } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";

function formatSeconds(s: number): string {
  if (s === 0) return "disabled";
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(s / 3600);
  return `${h} hour${h === 1 ? "" : "s"}`;
}

export const slowmodeCommand: Command = {
  name: "slowmode",
  aliases: ["slow", "sm"],
  description: "Set or view slowmode delay for the channel",
  usage: "[seconds (0 to disable)]",
  requiredPermissions: [], // permission checked manually below so view works for everyone

  async execute(message: Message, args: string[]) {
    const channel = message.channel as TextChannel;
    if (!("setRateLimitPerUser" in channel)) {
      return message.reply("❌ This command can only be used in a text channel.");
    }

    // No args — anyone can view current slowmode
    if (!args[0]) {
      const current = (channel as TextChannel).rateLimitPerUser ?? 0;
      return message.reply(
        current === 0
          ? `The current slowmode is **disabled**.`
          : `The current slowmode is **${formatSeconds(current)}**.`
      );
    }

    // Setting slowmode requires ManageChannels
    const canManage = message.member?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
    if (!canManage) {
      return message.reply("❌ You don't have permission to change slowmode.");
    }

    const seconds = parseInt(args[0], 10);
    if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
      return message.reply(usageErr(message, slowmodeCommand, "Provide a number between 0 and 21600 seconds"));
    }

    try {
      await channel.setRateLimitPerUser(seconds, `Set by ${message.author.tag}`);

      await message.reply(
        seconds === 0
          ? `Slowmode has been **disabled** in <#${channel.id}>.`
          : `Slowmode set to **${formatSeconds(seconds)}** in <#${channel.id}>.`
      );

      if (message.guild) {
        await sendModLog(message.client, message.guild.id, {
          action: seconds === 0 ? "Slowmode Disabled" : `Slowmode Set (${formatSeconds(seconds)})`,
          executor: { tag: message.author.tag, id: message.author.id },
          channel: { name: channel.name, id: channel.id },
          color: 0x9b59b6,
        });
      }

      logger.info({ seconds, channelId: channel.id }, "Slowmode set");
    } catch (err) {
      logger.error({ err }, "Failed to set slowmode");
      await message.reply("❌ Failed to set slowmode.");
    }
  },
};
