import { Client, ButtonInteraction, EmbedBuilder, Colors } from "discord.js";
import {
  getSuggestion, getSuggestionConfig, updateSuggestion, SuggestionStatus,
} from "../store/suggestions";
import { buildSuggestionEmbed } from "../commands/suggestions/suggest";

export function registerSuggestionVotes(client: Client) {
  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.guildId) return;

    const { customId } = interaction;

    if (customId.startsWith("sug_up:") || customId.startsWith("sug_down:")) {
      const parts = customId.split(":");
      const direction = parts[0] === "sug_up" ? "up" : "down";
      const sugId = parseInt(parts[1], 10);

      const cfg = await getSuggestionConfig(interaction.guildId);
      const suggestion = await getSuggestion(interaction.guildId, sugId);

      if (!suggestion) {
        return interaction.reply({ content: "Suggestion not found.", ephemeral: true });
      }

      if (suggestion.status !== "pending") {
        return interaction.reply({ content: "This suggestion is already closed.", ephemeral: true });
      }

      const userId = interaction.user.id;

      if (suggestion.authorId === userId) {
        return interaction.reply({ content: "You cannot vote on your own suggestion.", ephemeral: true });
      }

      let { upvotes, downvotes } = suggestion;

      if (direction === "up") {
        if (upvotes.includes(userId)) {
          upvotes = upvotes.filter(id => id !== userId);
        } else {
          upvotes = [...upvotes.filter(id => id !== userId), userId];
          downvotes = downvotes.filter(id => id !== userId);
        }
      } else {
        if (downvotes.includes(userId)) {
          downvotes = downvotes.filter(id => id !== userId);
        } else {
          downvotes = [...downvotes.filter(id => id !== userId), userId];
          upvotes = upvotes.filter(id => id !== userId);
        }
      }

      await updateSuggestion(interaction.guildId, sugId, { upvotes, downvotes });
      const updated = { ...suggestion, upvotes, downvotes };

      const { embed, components } = buildSuggestionEmbed(updated, cfg);

      await interaction.update({ embeds: [embed], components });
    }
  });
}
