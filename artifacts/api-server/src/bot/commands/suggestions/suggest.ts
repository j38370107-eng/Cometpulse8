import {
  Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, Colors, TextChannel,
} from "discord.js";
import type { Command } from "../types";
import {
  getSuggestionConfig, addSuggestion, getSuggestion, getGuildSuggestions,
  getSuggestionCooldown, setSuggestionCooldown, countUserOpenSuggestions,
  Suggestion, SuggestionConfig,
} from "../../store/suggestions";

export function buildSuggestionEmbed(
  suggestion: Suggestion,
  cfg: SuggestionConfig,
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const total = suggestion.upvotes.length + suggestion.downvotes.length;
  const upPct = total > 0 ? Math.round((suggestion.upvotes.length / total) * 100) : 0;
  const downPct = total > 0 ? 100 - upPct : 0;

  const barLength = 20;
  const filledUp = Math.round((upPct / 100) * barLength);
  const filledDown = barLength - filledUp;
  const bar = "▓".repeat(filledUp) + "░".repeat(filledDown);

  const statusColors: Record<string, number> = {
    pending: 0x5865F2,
    approved: 0x57F287,
    denied: 0xED4245,
    implemented: 0x1ABC9C,
    duplicate: 0x99AAB5,
    under_review: 0xFEE75C,
  };

  const statusLabels: Record<string, string> = {
    pending: "⏳ Pending",
    approved: "✅ Approved",
    denied: "❌ Denied",
    implemented: "🚀 Implemented",
    duplicate: "🔁 Duplicate",
    under_review: "🔍 Under Review",
  };

  const embed = new EmbedBuilder()
    .setColor(statusColors[suggestion.status] ?? 0x5865F2)
    .setTitle(`Suggestion #${String(suggestion.id).padStart(4, "0")}`)
    .setDescription(suggestion.content)
    .addFields(
      { name: "Status", value: statusLabels[suggestion.status] ?? suggestion.status, inline: true },
      { name: "Author", value: cfg.anonymousEnabled && suggestion.status === "pending" ? "Anonymous" : `<@${suggestion.authorId}>`, inline: true },
      { name: "Submitted", value: `<t:${Math.floor(suggestion.createdAt / 1000)}:R>`, inline: true },
      {
        name: `Votes — 👍 ${suggestion.upvotes.length} | 👎 ${suggestion.downvotes.length}`,
        value: `\`${bar}\` ${upPct}% upvoted`,
      },
    )
    .setFooter({ text: `Suggestion #${suggestion.id}` });

  if (suggestion.staffResponse) {
    embed.addFields({ name: "Staff Response", value: suggestion.staffResponse });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sug_up:${suggestion.id}`)
      .setLabel(`👍 ${suggestion.upvotes.length}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(suggestion.status !== "pending"),
    new ButtonBuilder()
      .setCustomId(`sug_down:${suggestion.id}`)
      .setLabel(`👎 ${suggestion.downvotes.length}`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(suggestion.status !== "pending"),
  );

  return { embed, components: [row] };
}

export const suggestCommand: Command = {
  name: "suggest",
  aliases: ["suggestion"],
  description: "Submit a suggestion",
  usage: "suggest <your suggestion>",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const cfg = await getSuggestionConfig(message.guild.id);
    if (!cfg.enabled || !cfg.channelId) {
      return message.reply("❌ Suggestions are not enabled on this server.");
    }
    if (cfg.locked) {
      return message.reply("🔒 Suggestions are currently locked.");
    }
    if (cfg.blacklistedUsers.includes(message.author.id)) {
      return message.reply("❌ You are not allowed to submit suggestions.");
    }
    if (cfg.requiredRole && !message.member?.roles.cache.has(cfg.requiredRole)) {
      return message.reply(`❌ You need the <@&${cfg.requiredRole}> role to suggest.`);
    }

    const cooldownEnd = getSuggestionCooldown(message.guild.id, message.author.id);
    if (Date.now() < cooldownEnd) {
      const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
      return message.reply(`⏳ You can suggest again in **${remaining}s**.`);
    }

    const content = args.join(" ").trim();
    if (!content) return message.reply("❌ Please provide your suggestion content.");
    if (content.length < 10) return message.reply("❌ Suggestion too short (min 10 chars).");
    if (content.length > 1000) return message.reply("❌ Suggestion too long (max 1000 chars).");

    const allSuggestions = await getGuildSuggestions(message.guild.id);
    const openCount = countUserOpenSuggestions(allSuggestions, message.author.id);
    if (openCount >= cfg.maxPerUser) {
      return message.reply(`❌ You already have **${openCount}** open suggestion(s). Max is ${cfg.maxPerUser}.`);
    }

    const sugChannel = message.guild.channels.cache.get(cfg.channelId) as TextChannel | null;
    if (!sugChannel) return message.reply("❌ Suggestion channel not found.");

    const suggestion = await addSuggestion(message.guild.id, {
      guildId: message.guild.id,
      authorId: message.author.id,
      content,
      status: "pending",
      upvotes: [],
      downvotes: [],
      messageId: "",
      channelId: cfg.channelId,
      staffResponse: "",
      reviewerId: "",
      createdAt: Date.now(),
    });

    const { embed, components } = buildSuggestionEmbed(suggestion, cfg);
    const msg = await sugChannel.send({ embeds: [embed], components });

    const { updateSuggestion } = await import("../../store/suggestions");
    await updateSuggestion(message.guild.id, suggestion.id, { messageId: msg.id });

    if (cfg.threadCreation) {
      await msg.startThread({ name: `Suggestion #${String(suggestion.id).padStart(4, "0")} Discussion` }).catch(() => {});
    }

    setSuggestionCooldown(message.guild.id, message.author.id, Date.now() + cfg.cooldownMs);

    await message.reply(`✅ Your suggestion has been submitted as **#${String(suggestion.id).padStart(4, "0")}** in ${sugChannel}!`);
  },
};
