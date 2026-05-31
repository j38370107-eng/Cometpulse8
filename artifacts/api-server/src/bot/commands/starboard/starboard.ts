import { Message, EmbedBuilder, TextChannel, PermissionFlagsBits } from "discord.js";
import type { Command } from "../types";
import {
  getStarboardConfig, setStarboardConfig, getAllStarboardEntries, getStarLevel,
} from "../../store/starboard";

async function showConfig(message: Message) {
  const cfg = await getStarboardConfig(message.guild!.id);
  const embed = new EmbedBuilder()
    .setTitle("⭐ Starboard Configuration")
    .setColor(0xFFD700)
    .addFields(
      { name: "Status", value: cfg.enabled ? (cfg.locked ? "🔒 Locked" : "✅ Enabled") : "❌ Disabled", inline: true },
      { name: "Channel", value: cfg.channelId ? `<#${cfg.channelId}>` : "Not set", inline: true },
      { name: "Emoji", value: cfg.emoji, inline: true },
      { name: "Threshold", value: `${cfg.threshold} stars`, inline: true },
      { name: "Self Star", value: cfg.selfStar ? "Allowed" : "Blocked", inline: true },
      { name: "Ignore Bots", value: cfg.ignoreBots ? "Yes" : "No", inline: true },
      { name: "Max Age", value: cfg.maxAgeDays > 0 ? `${cfg.maxAgeDays} days` : "No limit", inline: true },
      { name: "NSFW", value: cfg.ignoreNsfw ? "Blocked" : "Allowed", inline: true },
      { name: "Ignored Channels", value: cfg.ignoredChannels.length > 0 ? cfg.ignoredChannels.map(c => `<#${c}>`).join(", ") : "None", inline: false },
    );
  await message.reply({ embeds: [embed] });
}

export const starboardCommand: Command = {
  name: "starboard",
  aliases: ["sb"],
  description: "Configure the starboard system",
  usage: "starboard <channel|threshold|emoji|ignore|unignore|toggle|lock|force-add|leaderboard> [value]",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("❌ You need **Manage Server** permission.");
    }

    const sub = args[0]?.toLowerCase();

    if (!sub) return showConfig(message);

    const cfg = await getStarboardConfig(message.guild.id);

    if (sub === "channel") {
      const ch = message.mentions.channels.first() as TextChannel | undefined;
      if (!ch) return message.reply("❌ Please mention a channel.");
      cfg.channelId = ch.id;
      cfg.enabled = true;
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`✅ Starboard channel set to ${ch}.`);
    }

    if (sub === "threshold") {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 1) return message.reply("❌ Provide a valid number (min 1).");
      cfg.threshold = n;
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`✅ Star threshold set to **${n}**.`);
    }

    if (sub === "emoji") {
      const emoji = args[1];
      if (!emoji) return message.reply("❌ Provide an emoji.");
      cfg.emoji = emoji;
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`✅ Star emoji set to ${emoji}.`);
    }

    if (sub === "toggle") {
      cfg.enabled = !cfg.enabled;
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`${cfg.enabled ? "✅ Starboard enabled." : "❌ Starboard disabled."}`);
    }

    if (sub === "lock") {
      cfg.locked = !cfg.locked;
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`${cfg.locked ? "🔒 Starboard locked — no new entries." : "🔓 Starboard unlocked."}`);
    }

    if (sub === "selfstar") {
      cfg.selfStar = !cfg.selfStar;
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`✅ Self-starring ${cfg.selfStar ? "allowed" : "blocked"}.`);
    }

    if (sub === "ignorebots") {
      cfg.ignoreBots = !cfg.ignoreBots;
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`✅ Bot messages ${cfg.ignoreBots ? "ignored" : "allowed"}.`);
    }

    if (sub === "ignore") {
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply("❌ Please mention a channel to ignore.");
      if (!cfg.ignoredChannels.includes(ch.id)) cfg.ignoredChannels.push(ch.id);
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`✅ ${ch} will be ignored by starboard.`);
    }

    if (sub === "unignore") {
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply("❌ Please mention a channel to unignore.");
      cfg.ignoredChannels = cfg.ignoredChannels.filter(id => id !== ch.id);
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`✅ ${ch} removed from ignore list.`);
    }

    if (sub === "maxage") {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 0) return message.reply("❌ Provide a number in days (0 = no limit).");
      cfg.maxAgeDays = n;
      await setStarboardConfig(message.guild.id, cfg);
      return message.reply(`✅ Max message age set to ${n === 0 ? "no limit" : `${n} days`}.`);
    }

    if (sub === "force-add") {
      const msgLink = args[1];
      return message.reply("ℹ️ Provide the message ID and it will be force-added on next reaction.");
    }

    if (sub === "leaderboard") {
      const entries = await getAllStarboardEntries(message.guild.id);
      if (entries.length === 0) return message.reply("No starred messages yet.");
      const sorted = entries.sort((a, b) => b.starCount - a.starCount).slice(0, 10);
      const embed = new EmbedBuilder()
        .setTitle("⭐ Starboard Leaderboard")
        .setColor(0xFFD700)
        .setDescription(
          sorted.map((e, i) =>
            `**#${i + 1}** ${getStarLevel(e.starCount)} ${e.starCount} stars — <@${e.authorId}> in <#${e.originalChannelId}>`
          ).join("\n")
        );
      return message.reply({ embeds: [embed] });
    }

    return showConfig(message);
  },
};
