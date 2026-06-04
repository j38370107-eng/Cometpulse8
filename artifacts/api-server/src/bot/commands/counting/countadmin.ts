import type { Command } from "../types";
import { PermissionFlagsBits } from "discord.js";
import {
  getCountingState,
  setCountingState,
  resetCountingStats,
  getCountingConfig,
} from "../../store/counting";
import { parseCount, formatCount } from "../../counting/parse";
import { getPrefix } from "../../store/prefixes";

export const setcountCommand: Command = {
  name: "setcount",
  aliases: ["countset-value", "forcecountat"],
  description: "Manually set the current count.",
  usage: "<number>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const prefix = getPrefix(guildId);
    const config = getCountingConfig(guildId);

    if (!args[0]) {
      return message.reply(`❌ Usage: \`${prefix}setcount <number>\``);
    }

    const n = parseInt(args[0]);
    if (isNaN(n) || n < 0) {
      return message.reply("❌ Please provide a valid non-negative number.");
    }

    const state = getCountingState(guildId);
    await setCountingState(guildId, {
      currentCount: n,
      highScore: Math.max(state.highScore, n),
      lastUserId: null,
      lastMessageId: null,
    });

    return message.reply(
      `✅ Count manually set to **${formatCount(n, config.mode)}**. Next count: **${formatCount(n + 1, config.mode)}**`
    );
  },
};

export const resetcountCommand: Command = {
  name: "resetcount",
  aliases: ["countreset", "countingreset"],
  description: "Reset the count back to 0.",
  usage: "[--stats]",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const resetStats = args.includes("--stats");

    await setCountingState(guildId, {
      currentCount: 0,
      lastUserId: null,
      lastMessageId: null,
      lastCheckpoint: 0,
    });

    if (resetStats) {
      await resetCountingStats(guildId);
      return message.reply("✅ Count and all stats have been reset to 0.");
    }

    return message.reply("✅ Count has been reset to 0. Next count: **1**");
  },
};
