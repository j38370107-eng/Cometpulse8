import {
  Client,
  Interaction,
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  TextChannel,
  PermissionFlagsBits,
  AttachmentBuilder,
} from "discord.js";
import {
  getTicketConfig,
  isBlacklisted,
  nextTicketNumber,
  openTicket,
  getTicket,
  updateTicket,
  closeTicketRecord,
  deleteTicketRecord,
  getUserOpenTicket,
} from "../store/tickets";
import { dbGet } from "../store/db";
import { generateTranscript } from "../lib/transcript";
import { logger } from "../../lib/logger";

// ── Welcome embed inside ticket ───────────────────────────────────────────────
function buildTicketEmbed(userTag: string, customMessage?: string): EmbedBuilder {
  const defaultMsg =
    `Thanks for creating a ticket! We'll be with you as quickly as possible.\n\n` +
    `While you wait, please now send anything relevant to your query so our team doesn't have to start by asking. ` +
    `Some things you should include are what your ticket is about and anything else that may be required, like user ID's and etc.`;
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Support Ticket")
    .setDescription(customMessage?.trim() || defaultMsg)
    .setFooter({ text: `Opened by ${userTag}` })
    .setTimestamp();
}

function buildTicketButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:claim")
      .setLabel("Claim")
      .setEmoji("🗂️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket:close")
      .setLabel("Close")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:delete")
      .setLabel("Delete")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );
  return [row1, row2];
}

// ── Send transcript to log channel ────────────────────────────────────────────
async function sendTranscriptLog(
  client: Client,
  guildId: string,
  channel: TextChannel,
  action: string,
  actorTag: string,
  transcript: AttachmentBuilder
): Promise<void> {
  const cfg = getTicketConfig(guildId);
  if (!cfg.logChannelId) return;
  try {
    const logChannel = (await client.channels.fetch(cfg.logChannelId)) as TextChannel;
    if (!logChannel || !("send" in logChannel)) return;
    const ticket = getTicket(channel.id);
    const embed = new EmbedBuilder()
      .setColor(action === "Deleted" ? 0xe74c3c : 0xf39c12)
      .setTitle(`🎫 Ticket ${action} — #${channel.name}`)
      .addFields(
        { name: "User", value: ticket ? `<@${ticket.userId}> (${ticket.userTag})` : "Unknown", inline: true },
        { name: action === "Deleted" ? "Deleted by" : "Closed by", value: actorTag, inline: true },
        { name: "Claimed by", value: ticket?.claimedByTag ?? "Unclaimed", inline: true }
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed], files: [transcript] });
  } catch (err) {
    logger.error({ err }, "Failed to send ticket transcript log");
  }
}

// ── Button handlers ───────────────────────────────────────────────────────────
async function handleCreate(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild!;
  const user = interaction.user;
  const guildId = guild.id;

  await interaction.deferReply({ ephemeral: true });

  if (isBlacklisted(guildId, user.id)) {
    return interaction.editReply({ content: "❌ You are blacklisted from creating tickets." });
  }

  const existing = getUserOpenTicket(guildId, user.id);
  if (existing) {
    return interaction.editReply({ content: `❌ You already have an open ticket: <#${existing.channelId}>` });
  }

  const cfg = getTicketConfig(guildId);
  const num = nextTicketNumber(guildId);
  const channelName = `support-${user.id}`;

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: cfg.categoryId ?? null,
      topic: `Ticket #${num} — ${user.tag}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
        ...(cfg.supportRoleId ? [{ id: cfg.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ],
    }) as TextChannel;

    openTicket({
      channelId: channel.id,
      userId: user.id,
      userTag: user.tag,
      createdAt: Date.now(),
      closed: false,
    });

    // Ping line
    const pingParts: string[] = [`<@${user.id}>`];
    if (cfg.pingRoleId) pingParts.push(`<@&${cfg.pingRoleId}>`);
    const pingMsg = await channel.send({ content: pingParts.join(" ") });

    // Look up panel-specific opening message by matching the channel where the button was clicked
    const panels = await dbGet<Record<string, any>>("ticketPanels", guildId) ?? {};
    const matchedPanel = Object.values(panels).find((p: any) => p.panelChannelId === interaction.channelId);
    const openMessage = matchedPanel?.openMessage?.trim() || cfg.openMessage;

    // Welcome embed + buttons
    const embed = buildTicketEmbed(user.tag, openMessage);
    const rows = buildTicketButtons();
    const welcomeMsg = await channel.send({ embeds: [embed], components: rows });

    await welcomeMsg.pin().catch(() => {});
    await pingMsg.delete().catch(() => {});

    await interaction.editReply({ content: `✅ Your ticket has been created: <#${channel.id}>` });
    logger.info({ userId: user.id, channelId: channel.id }, "Ticket created");
  } catch (err) {
    logger.error({ err }, "Failed to create ticket channel");
    await interaction.editReply({ content: "❌ Failed to create ticket. Make sure the bot has the right permissions." });
  }
}

async function handleClaim(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return interaction.editReply({ content: "❌ This is not a tracked ticket." });
  if (ticket.claimedBy) return interaction.editReply({ content: `❌ Already claimed by <@${ticket.claimedBy}>.` });

  updateTicket(interaction.channelId, {
    claimedBy: interaction.user.id,
    claimedByTag: interaction.user.tag,
  });

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setDescription(`🗂️ Ticket claimed by <@${interaction.user.id}>.`);
  await interaction.channel?.send({ embeds: [embed] });
  await interaction.editReply({ content: "✅ You have claimed this ticket." });
}

async function handleClose(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: false });
  const channel = interaction.channel as TextChannel;
  const ticket = getTicket(channel.id);
  if (!ticket) return interaction.editReply({ content: "❌ This is not a tracked ticket." });
  if (ticket.closed) return interaction.editReply({ content: "❌ This ticket is already closed." });

  // Remove user's send permission
  try {
    await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false });
  } catch { /* user may have left */ }

  closeTicketRecord(channel.id);

  const transcript = await generateTranscript(channel, ticket);
  await sendTranscriptLog(interaction.client, interaction.guildId!, channel, "Closed", interaction.user.tag, transcript);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setDescription(`🔒 Ticket closed by <@${interaction.user.id}>.\nUse **Delete** to remove this channel.`);

  const deleteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:delete")
      .setLabel("Delete")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [embed], components: [deleteRow] });
}

async function handleDelete(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel as TextChannel;
  const ticket = getTicket(channel.id);

  const transcript = ticket
    ? await generateTranscript(channel, ticket)
    : new AttachmentBuilder(Buffer.from("No ticket data."), { name: "transcript.txt" });

  await sendTranscriptLog(interaction.client, interaction.guildId!, channel, "Deleted", interaction.user.tag, transcript);

  await interaction.editReply({ content: "🗑️ Deleting ticket..." });

  if (ticket) deleteTicketRecord(channel.id);

  setTimeout(async () => {
    try {
      await channel.delete();
    } catch (err) {
      logger.error({ err }, "Failed to delete ticket channel");
    }
  }, 1500);
}

// ── Registration ──────────────────────────────────────────────────────────────
export function registerTicketButtons(client: Client) {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;

    const { customId } = interaction;
    if (!customId.startsWith("ticket:")) return;

    try {
      if (customId === "ticket:create") await handleCreate(interaction);
      else if (customId === "ticket:claim") await handleClaim(interaction);
      else if (customId === "ticket:close") await handleClose(interaction);
      else if (customId === "ticket:delete") await handleDelete(interaction);
    } catch (err) {
      logger.error({ err, customId }, "Ticket button handler failed");
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
      }
    }
  });
}
