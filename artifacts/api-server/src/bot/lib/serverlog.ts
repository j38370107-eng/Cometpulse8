import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { getServerLogChannel } from "../store/serverlog";
import { logger } from "../../lib/logger";

export interface ServerLogEntry {
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: string;
}

export async function sendServerLog(client: Client, guildId: string, entry: ServerLogEntry) {
  const channelId = getServerLogChannel(guildId);
  if (!channelId) return;

  let channel: TextChannel | null = null;
  try {
    channel = (await client.channels.fetch(channelId)) as TextChannel;
  } catch {
    return;
  }

  if (!channel || !("send" in channel)) return;

  const embed = new EmbedBuilder()
    .setColor(entry.color)
    .setTitle(entry.title)
    .setDescription(entry.description)
    .setTimestamp();

  if (entry.fields?.length) embed.addFields(entry.fields);
  if (entry.footer) embed.setFooter({ text: entry.footer });

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err, channelId, guildId }, "Failed to send server log");
  }
}
