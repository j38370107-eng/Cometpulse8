import {
  Client, Message, TextChannel, EmbedBuilder,
  MessageReaction, User, PartialMessageReaction, PartialUser,
} from "discord.js";
import {
  getStarboardConfig, getStarboardEntry, setStarboardEntry,
  deleteStarboardEntry, getStarLevel, StarboardEntry,
} from "../store/starboard";
import { logger } from "../../lib/logger";

function formatEmoji(emoji: string): string {
  return emoji;
}

function emojiMatches(reactionEmoji: MessageReaction["emoji"], configEmoji: string): boolean {
  if (configEmoji === "⭐") return reactionEmoji.name === "⭐";
  if (reactionEmoji.id) return reactionEmoji.id === configEmoji || `<:${reactionEmoji.name}:${reactionEmoji.id}>` === configEmoji;
  return reactionEmoji.name === configEmoji;
}

async function buildStarboardEmbed(msg: Message, starCount: number, cfg: any) {
  const level = getStarLevel(starCount);
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
    .setDescription(msg.content || null)
    .addFields({ name: "Source", value: `[Jump to message](${msg.url})`, inline: true })
    .setFooter({ text: `${level} ${starCount} stars • #${(msg.channel as TextChannel).name}` })
    .setTimestamp(msg.createdAt);

  const image = msg.attachments.find(a => a.contentType?.startsWith("image/"));
  if (image) embed.setImage(image.url);

  const firstEmbed = msg.embeds[0];
  if (firstEmbed?.image) embed.setImage(firstEmbed.image.url);
  if (firstEmbed?.thumbnail) embed.setThumbnail(firstEmbed.thumbnail.url);

  return embed;
}

async function handleReactionChange(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  try {
    if (reaction.partial) reaction = await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const msg = reaction.message as Message;
    if (!msg.guild) return;

    const guildId = msg.guild.id;
    const cfg = await getStarboardConfig(guildId);

    if (!cfg.enabled || cfg.locked || !cfg.channelId) return;
    if (!emojiMatches(reaction.emoji, cfg.emoji)) return;
    if (cfg.ignoredChannels.includes(msg.channelId)) return;

    const channel = msg.channel as TextChannel;
    if (cfg.ignoreNsfw && channel.nsfw) return;
    if (cfg.ignoreBots && msg.author.bot) return;

    if (cfg.maxAgeDays > 0) {
      const ageDays = (Date.now() - msg.createdTimestamp) / 86_400_000;
      if (ageDays > cfg.maxAgeDays) return;
    }

    const fullUser = user.partial ? await user.fetch() : user;
    if (cfg.ignoredRoles.length > 0) {
      const member = await msg.guild.members.fetch(fullUser.id).catch(() => null);
      if (member && member.roles.cache.some(r => cfg.ignoredRoles.includes(r.id))) return;
    }

    await reaction.fetch();
    const users = await reaction.users.fetch();

    let starCount = users.filter(u => !u.bot).size;
    if (!cfg.selfStar) {
      if (users.has(msg.author.id)) starCount--;
    }

    const entry = await getStarboardEntry(guildId, msg.id);
    const starboardChannel = msg.guild.channels.cache.get(cfg.channelId) as TextChannel | null;
    if (!starboardChannel) return;

    if (starCount < cfg.threshold) {
      if (entry) {
        try {
          const sbMsg = await starboardChannel.messages.fetch(entry.starboardMessageId).catch(() => null);
          if (sbMsg) await sbMsg.delete();
        } catch {}
        await deleteStarboardEntry(guildId, msg.id);
      }
      return;
    }

    const embed = await buildStarboardEmbed(msg, starCount, cfg);
    const level = getStarLevel(starCount);
    const content = `${level} **${starCount}** <#${msg.channelId}>`;

    if (entry) {
      try {
        const sbMsg = await starboardChannel.messages.fetch(entry.starboardMessageId).catch(() => null);
        if (sbMsg) {
          await sbMsg.edit({ content, embeds: [embed] });
          await setStarboardEntry(guildId, msg.id, { ...entry, starCount });
        }
      } catch (e) {
        logger.warn({ err: e }, "Starboard update failed");
      }
    } else {
      try {
        const sbMsg = await starboardChannel.send({ content, embeds: [embed] });
        const newEntry: StarboardEntry = {
          originalMessageId: msg.id,
          originalChannelId: msg.channelId,
          authorId: msg.author.id,
          starboardMessageId: sbMsg.id,
          starCount,
          postedAt: Date.now(),
        };
        await setStarboardEntry(guildId, msg.id, newEntry);
      } catch (e) {
        logger.warn({ err: e }, "Starboard post failed");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Starboard reaction handler error");
  }
}

export function registerStarboardEvents(client: Client) {
  client.on("messageReactionAdd", (reaction, user) => handleReactionChange(reaction, user));
  client.on("messageReactionRemove", (reaction, user) => handleReactionChange(reaction, user));

  client.on("messageDelete", async msg => {
    if (!msg.guild) return;
    const cfg = await getStarboardConfig(msg.guild.id).catch(() => null);
    if (!cfg?.channelId) return;
    const entry = await getStarboardEntry(msg.guild.id, msg.id).catch(() => null);
    if (!entry) return;
    const sbChannel = msg.guild.channels.cache.get(cfg.channelId) as TextChannel | null;
    if (sbChannel) {
      const sbMsg = await sbChannel.messages.fetch(entry.starboardMessageId).catch(() => null);
      if (sbMsg) await sbMsg.delete().catch(() => {});
    }
    await deleteStarboardEntry(msg.guild.id, msg.id).catch(() => {});
  });
}
