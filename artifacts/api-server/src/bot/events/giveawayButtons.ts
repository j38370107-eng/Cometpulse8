import { Client, ButtonInteraction } from "discord.js";
import {
  getGiveaway,
  saveGiveaway,
} from "../store/giveaways";
import {
  checkEntry,
  updateGiveawayMessage,
} from "../giveaway/manager";
import { logger } from "../../lib/logger";

export function registerGiveawayButtons(client: Client): void {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("giveaway:enter:")) return;

    const giveawayId = interaction.customId.slice("giveaway:enter:".length);
    const guildId = interaction.guildId;
    if (!guildId) return;

    const gi = getGiveaway(guildId, giveawayId);
    if (!gi) {
      return interaction
        .reply({ content: "❌ Giveaway not found.", ephemeral: true })
        .catch(() => {});
    }

    if (gi.ended || gi.cancelled) {
      return interaction
        .reply({ content: "❌ This giveaway has already ended.", ephemeral: true })
        .catch(() => {});
    }

    const userId = interaction.user.id;

    // Defer to avoid timeout
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    // Get member for eligibility checks
    const member = await interaction.guild?.members.fetch(userId).catch(() => null);
    if (!member) {
      return interaction
        .editReply("❌ Could not verify your membership.")
        .catch(() => {});
    }

    // Check for existing entry
    const existingEntry = gi.entries.find((e) => e.userId === userId);
    if (existingEntry) {
      return interaction
        .editReply(`✅ You're already entered with **${existingEntry.entries}** entries!`)
        .catch(() => {});
    }

    // Run eligibility + bonus calculation
    const check = await checkEntry(gi, userId, member);
    if (!check.allowed) {
      return interaction
        .editReply(`❌ You can't enter: ${check.reason}`)
        .catch(() => {});
    }

    // Add entry
    const entries = [...gi.entries, { userId, entries: check.totalEntries }];
    const updated = { ...gi, entries };
    saveGiveaway(updated);

    // Update the embed with new entry count (fire and forget)
    updateGiveawayMessage(updated).catch((err) =>
      logger.warn({ err }, "Failed to update giveaway message after entry")
    );

    const bonusText =
      check.totalEntries > 1
        ? ` (including **${check.totalEntries - 1}** bonus entries!)`
        : "";
    const totalPoolEntries = entries.reduce((s, e) => s + e.entries, 0);

    return interaction
      .editReply(
        `🎉 You've been entered into **${gi.prize}**${bonusText}\nYou have **${check.totalEntries}** entries out of **${totalPoolEntries}** total.`
      )
      .catch(() => {});
  });
}
