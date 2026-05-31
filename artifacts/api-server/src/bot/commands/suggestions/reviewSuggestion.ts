import { Message, EmbedBuilder, TextChannel, PermissionFlagsBits } from "discord.js";
import type { Command } from "../types";
import {
  getSuggestionConfig, getSuggestion, updateSuggestion, deleteSuggestion,
  getGuildSuggestions, SuggestionStatus,
} from "../../store/suggestions";
import { buildSuggestionEmbed } from "./suggest";

async function resolveAndUpdate(
  message: Message,
  args: string[],
  status: SuggestionStatus,
  label: string,
) {
  if (!message.guild) return;
  const cfg = await getSuggestionConfig(message.guild.id);

  if (cfg.staffRole && !message.member?.roles.cache.has(cfg.staffRole) &&
      !message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply("❌ You don't have permission to review suggestions.");
  }

  const id = parseInt(args[0], 10);
  if (isNaN(id)) return message.reply("❌ Provide a valid suggestion number.");

  const suggestion = await getSuggestion(message.guild.id, id);
  if (!suggestion) return message.reply(`❌ Suggestion #${id} not found.`);

  const reason = args.slice(1).join(" ").trim() || "No reason provided.";

  await updateSuggestion(message.guild.id, id, {
    status,
    staffResponse: reason,
    reviewerId: message.author.id,
  });

  const updated = { ...suggestion, status, staffResponse: reason, reviewerId: message.author.id };
  const { embed, components } = buildSuggestionEmbed(updated, cfg);

  try {
    const ch = message.guild.channels.cache.get(suggestion.channelId) as TextChannel | null;
    if (ch && suggestion.messageId) {
      const msg = await ch.messages.fetch(suggestion.messageId).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed], components });
    }
  } catch {}

  if (cfg.dmNotify && suggestion.authorId) {
    try {
      const user = await message.client.users.fetch(suggestion.authorId).catch(() => null);
      if (user) {
        const statusEmoji: Record<string, string> = {
          approved: "✅", denied: "❌", implemented: "🚀", duplicate: "🔁", under_review: "🔍",
        };
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Your suggestion has been ${status}`)
              .setDescription(`**#${String(id).padStart(4, "0")}:** ${suggestion.content}`)
              .addFields({ name: "Staff Response", value: reason })
              .setColor(status === "approved" || status === "implemented" ? 0x57F287 : status === "denied" ? 0xED4245 : 0x5865F2)
              .setTimestamp(),
          ],
        }).catch(() => {});
      }
    } catch {}
  }

  return message.reply(`${label} Suggestion **#${String(id).padStart(4, "0")}** marked as ${status}.`);
}

export const approveCommand: Command = {
  name: "approve",
  aliases: ["sug-approve"],
  description: "Approve a suggestion",
  usage: "approve <id> [reason]",
  async execute(message: Message, args: string[]) {
    return resolveAndUpdate(message, args, "approved", "✅");
  },
};

export const denyCommand: Command = {
  name: "deny",
  aliases: ["sug-deny"],
  description: "Deny a suggestion",
  usage: "deny <id> [reason]",
  async execute(message: Message, args: string[]) {
    return resolveAndUpdate(message, args, "denied", "❌");
  },
};

export const implementCommand: Command = {
  name: "implement",
  aliases: ["sug-implement"],
  description: "Mark a suggestion as implemented",
  usage: "implement <id> [note]",
  async execute(message: Message, args: string[]) {
    return resolveAndUpdate(message, args, "implemented", "🚀");
  },
};

export const duplicateCommand: Command = {
  name: "duplicate",
  aliases: ["sug-duplicate"],
  description: "Mark a suggestion as duplicate",
  usage: "duplicate <id> [note]",
  async execute(message: Message, args: string[]) {
    return resolveAndUpdate(message, args, "duplicate", "🔁");
  },
};

export const deleteSuggestionCommand: Command = {
  name: "delsuggestion",
  aliases: ["deletesug"],
  description: "Delete a suggestion",
  usage: "delsuggestion <id>",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const cfg = await getSuggestionConfig(message.guild.id);
    if (cfg.staffRole && !message.member?.roles.cache.has(cfg.staffRole) &&
        !message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("❌ No permission.");
    }
    const id = parseInt(args[0], 10);
    if (isNaN(id)) return message.reply("❌ Provide a suggestion number.");
    const suggestion = await getSuggestion(message.guild.id, id);
    if (!suggestion) return message.reply(`❌ Suggestion #${id} not found.`);
    try {
      const ch = message.guild.channels.cache.get(suggestion.channelId) as TextChannel | null;
      if (ch && suggestion.messageId) {
        const msg = await ch.messages.fetch(suggestion.messageId).catch(() => null);
        if (msg) await msg.delete();
      }
    } catch {}
    await deleteSuggestion(message.guild.id, id);
    return message.reply(`🗑️ Suggestion **#${id}** deleted.`);
  },
};

export const suggestionsConfigCommand: Command = {
  name: "suggestconfig",
  aliases: ["sugconfig"],
  description: "Configure the suggestion system",
  usage: "suggestconfig <channel|staffrole|cooldown|maxperuser|toggle|lock|anonymous|dmnotify|threads|blacklist|unblacklist> [value]",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("❌ Manage Server required.");
    }

    const cfg = await getSuggestionConfig(message.guild.id);
    const { setSuggestionConfig } = await import("../../store/suggestions");
    const sub = args[0]?.toLowerCase();

    if (!sub) {
      const embed = new EmbedBuilder()
        .setTitle("💡 Suggestion Configuration")
        .setColor(0x5865F2)
        .addFields(
          { name: "Status", value: cfg.enabled ? (cfg.locked ? "🔒 Locked" : "✅ Enabled") : "❌ Disabled", inline: true },
          { name: "Channel", value: cfg.channelId ? `<#${cfg.channelId}>` : "Not set", inline: true },
          { name: "Staff Role", value: cfg.staffRole ? `<@&${cfg.staffRole}>` : "None", inline: true },
          { name: "Cooldown", value: `${cfg.cooldownMs / 60000} min`, inline: true },
          { name: "Max Per User", value: `${cfg.maxPerUser}`, inline: true },
          { name: "DM Notify", value: cfg.dmNotify ? "On" : "Off", inline: true },
          { name: "Anonymous", value: cfg.anonymousEnabled ? "On" : "Off", inline: true },
          { name: "Threads", value: cfg.threadCreation ? "On" : "Off", inline: true },
        );
      return message.reply({ embeds: [embed] });
    }

    if (sub === "channel") {
      const ch = message.mentions.channels.first() as TextChannel | undefined;
      if (!ch) return message.reply("❌ Mention a channel.");
      cfg.channelId = ch.id; cfg.enabled = true;
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ Suggestion channel set to ${ch}.`);
    }
    if (sub === "staffrole") {
      const role = message.mentions.roles.first();
      cfg.staffRole = role?.id ?? "";
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ Staff role ${role ? `set to ${role}` : "cleared"}.`);
    }
    if (sub === "cooldown") {
      const min = parseInt(args[1], 10);
      if (isNaN(min) || min < 0) return message.reply("❌ Provide minutes (0 = no cooldown).");
      cfg.cooldownMs = min * 60000;
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ Cooldown set to **${min} minutes**.`);
    }
    if (sub === "maxperuser") {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 1) return message.reply("❌ Provide a number >= 1.");
      cfg.maxPerUser = n;
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ Max suggestions per user: **${n}**.`);
    }
    if (sub === "toggle") {
      cfg.enabled = !cfg.enabled;
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`${cfg.enabled ? "✅ Suggestions enabled." : "❌ Suggestions disabled."}`);
    }
    if (sub === "lock") {
      cfg.locked = !cfg.locked;
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`${cfg.locked ? "🔒 Suggestions locked." : "🔓 Suggestions unlocked."}`);
    }
    if (sub === "anonymous") {
      cfg.anonymousEnabled = !cfg.anonymousEnabled;
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ Anonymous suggestions: **${cfg.anonymousEnabled ? "on" : "off"}**.`);
    }
    if (sub === "dmnotify") {
      cfg.dmNotify = !cfg.dmNotify;
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ DM notifications: **${cfg.dmNotify ? "on" : "off"}**.`);
    }
    if (sub === "threads") {
      cfg.threadCreation = !cfg.threadCreation;
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ Thread creation: **${cfg.threadCreation ? "on" : "off"}**.`);
    }
    if (sub === "blacklist") {
      const user = message.mentions.users.first();
      if (!user) return message.reply("❌ Mention a user.");
      if (!cfg.blacklistedUsers.includes(user.id)) cfg.blacklistedUsers.push(user.id);
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ ${user.tag} blacklisted from suggestions.`);
    }
    if (sub === "unblacklist") {
      const user = message.mentions.users.first();
      if (!user) return message.reply("❌ Mention a user.");
      cfg.blacklistedUsers = cfg.blacklistedUsers.filter(id => id !== user.id);
      await setSuggestionConfig(message.guild.id, cfg);
      return message.reply(`✅ ${user.tag} removed from blacklist.`);
    }

    return message.reply("❌ Unknown subcommand.");
  },
};

export const viewSuggestionCommand: Command = {
  name: "suggestion",
  aliases: ["viewsug"],
  description: "View a suggestion by number",
  usage: "suggestion <id>",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const id = parseInt(args[0], 10);
    if (isNaN(id)) return message.reply("❌ Provide a suggestion number.");
    const cfg = await getSuggestionConfig(message.guild.id);
    const suggestion = await getSuggestion(message.guild.id, id);
    if (!suggestion) return message.reply(`❌ Suggestion #${id} not found.`);
    const { embed, components } = buildSuggestionEmbed(suggestion, cfg);
    return message.reply({ embeds: [embed], components });
  },
};

export const suggestionsLeaderboardCommand: Command = {
  name: "suggestionsleaderboard",
  aliases: ["sugtop"],
  description: "View most upvoted suggestions",
  usage: "suggestionsleaderboard",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const all = await getGuildSuggestions(message.guild.id);
    if (all.length === 0) return message.reply("No suggestions yet.");
    const sorted = [...all].sort((a, b) => b.upvotes.length - a.upvotes.length).slice(0, 10);
    const embed = new EmbedBuilder()
      .setTitle("💡 Top Suggestions")
      .setColor(0x5865F2)
      .setDescription(
        sorted.map((s, i) =>
          `**#${i + 1}** 👍 ${s.upvotes.length} — #${String(s.id).padStart(4, "0")}: ${s.content.slice(0, 60)}${s.content.length > 60 ? "..." : ""}`
        ).join("\n")
      );
    return message.reply({ embeds: [embed] });
  },
};
