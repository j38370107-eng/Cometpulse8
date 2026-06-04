import { Client, Message, TextChannel, EmbedBuilder } from "discord.js";
import { logger } from "../../lib/logger";
import {
  getCountingConfig,
  getCountingState,
  setCountingState,
  addCountingContribution,
  addCountingFail,
} from "../store/counting";
import { parseCount, formatCount } from "../counting/parse";

async function updateChannelTopic(channel: TextChannel, count: number, highScore: number): Promise<void> {
  try {
    await channel.setTopic(`Current count: ${count} | High score: ${highScore}`);
  } catch {
    // Missing permission — silently skip
  }
}

export function registerCountingEvents(client: Client): void {
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const config = getCountingConfig(guildId);
    if (!config.channelId || message.channelId !== config.channelId) return;

    const content = message.content.trim();
    const state = getCountingState(guildId);
    const expected = state.currentCount + 1;

    const parsed = parseCount(content, config.mode);

    // ── Wrong number or unparseable ───────────────────────────────────────────
    if (parsed === null || parsed !== expected) {
      await message.react("❌").catch(() => {});

      if (config.deleteWrong) {
        await message.delete().catch(() => {});
      }

      // Fail tracking
      const newFails = state.totalFails + 1;
      let resetTo = 0;
      if (config.checkpointInterval > 0) {
        resetTo = state.lastCheckpoint;
      }

      await addCountingFail(guildId, message.author.id);
      await setCountingState(guildId, {
        currentCount: resetTo,
        totalFails: newFails,
        lastFailUserId: message.author.id,
        lastUserId: null,
        lastMessageId: null,
        lastCheckpoint: 0,
      });

      const channel = message.channel as TextChannel;

      if (config.resetOnFail) {
        const resetMsg = config.checkpointInterval > 0 && resetTo > 0
          ? `❌ <@${message.author.id}> ruined the count at **${state.currentCount}**! Resetting back to the checkpoint at **${resetTo}**. Start from **${formatCount(resetTo + 1, config.mode)}**.`
          : `❌ <@${message.author.id}> ruined the count at **${state.currentCount}**! Starting back from **${formatCount(1, config.mode)}**.`;
        await channel.send(resetMsg).catch(() => {});
      }

      // DM the person who ruined it
      if (config.failPunishment !== "nothing") {
        try {
          await message.author.send(
            `😬 You ruined the count in **${message.guild.name}** at **${state.currentCount}**! The count has been reset.`
          );
        } catch { /* DMs closed */ }
      }

      // Timeout punishment
      if (config.failPunishment === "timeout" && message.member) {
        await message.member.timeout(60_000, "Ruined the counting game").catch(() => {});
      }

      if (config.updateTopic) {
        await updateChannelTopic(channel, resetTo, state.highScore);
      }

      return;
    }

    // ── Same user twice in a row ──────────────────────────────────────────────
    if (config.noSameUserTwice && state.lastUserId === message.author.id) {
      await message.react("❌").catch(() => {});
      if (config.deleteWrong) await message.delete().catch(() => {});

      const channel = message.channel as TextChannel;
      const notice = await channel.send(
        `⚠️ <@${message.author.id}>, you can't count twice in a row!`
      ).catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 6000);
      return;
    }

    // ── Correct count ─────────────────────────────────────────────────────────
    const newCount = parsed;
    const newHighScore = Math.max(state.highScore, newCount);
    const isNewHighScore = newCount > state.highScore;

    let newCheckpoint = state.lastCheckpoint;
    if (config.checkpointInterval > 0 && newCount % config.checkpointInterval === 0) {
      newCheckpoint = newCount;
    }

    await setCountingState(guildId, {
      currentCount: newCount,
      highScore: newHighScore,
      lastUserId: message.author.id,
      lastMessageId: message.id,
      lastCheckpoint: newCheckpoint,
    });

    await addCountingContribution(guildId, message.author.id);

    const channel = message.channel as TextChannel;

    // React with correct emoji
    const isMilestone =
      config.milestoneInterval > 0 && newCount % config.milestoneInterval === 0;
    const reactEmoji = isMilestone ? config.milestoneEmoji : config.reactEmoji;
    await message.react(reactEmoji).catch(() => {});

    // Milestone celebration
    if (isMilestone) {
      const milestoneEmbed = new EmbedBuilder()
        .setColor(0xf4c430)
        .setTitle(`${config.milestoneEmoji} Milestone Reached!`)
        .setDescription(
          `The count has reached **${formatCount(newCount, config.mode)}**! Amazing work everyone!`
        )
        .setTimestamp();

      let content: string | undefined;
      if (config.milestoneRoleId) {
        content = `<@&${config.milestoneRoleId}>`;
      }

      await channel.send({ content, embeds: [milestoneEmbed] }).catch(() => {});
    }

    // New high score announcement
    if (isNewHighScore && newCount > 1) {
      await channel.send(`🏆 **New high score!** The count has reached **${formatCount(newCount, config.mode)}** — a new record!`).catch(() => {});
    }

    // Update channel topic
    if (config.updateTopic) {
      await updateChannelTopic(channel, newCount, newHighScore);
    }
  });
}
