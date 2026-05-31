import {
  Client, Interaction, ButtonInteraction, ModalSubmitInteraction,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  TextChannel, ButtonBuilder, ButtonStyle, EmbedBuilder,
} from "discord.js";
import {
  getSession, setSession, deleteSession, createEmptySession,
  getTemplates, saveTemplate, getEmbedSettings,
  EmbedData,
} from "../store/embedBuilder";
import {
  buildPreviewEmbed, buildBuilderRows, parseColor, BUILDER_CONTENT,
  embedDataToDiscohookJson,
} from "../lib/embedBuilderUtils";
import { logger } from "../../lib/logger";

// ── Refresh the builder message ───────────────────────────────────────────────

async function refreshUI(
  client: Client,
  session: ReturnType<typeof getSession>,
  interaction: ButtonInteraction | ModalSubmitInteraction,
  isButton: boolean,
): Promise<void> {
  if (!session) return;
  const preview = buildPreviewEmbed(session.data);
  const rows = buildBuilderRows(session.userId, session.data.fields.length);

  if (isButton) {
    await (interaction as ButtonInteraction).update({
      content: BUILDER_CONTENT,
      embeds: [preview],
      components: rows,
    }).catch(() => {});
  } else {
    await (interaction as ModalSubmitInteraction).deferUpdate().catch(() => {});
    const ch = client.channels.cache.get(session.channelId) as TextChannel | null;
    if (ch && session.builderMessageId) {
      const msg = await ch.messages.fetch(session.builderMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ content: BUILDER_CONTENT, embeds: [preview], components: rows }).catch(() => {});
      }
    }
  }
}

// ── Handle button interactions ────────────────────────────────────────────────

async function handleButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const userId = parts[2];

  if (interaction.user.id !== userId) {
    return interaction.reply({ content: "❌ This builder belongs to someone else.", ephemeral: true });
  }

  const guildId = interaction.guildId!;
  const session = getSession(userId, guildId);

  // ── close / reset ──────────────────────────────────────────────────────────
  if (action === "close") {
    deleteSession(userId, guildId);
    await interaction.update({
      content: "❌ Embed builder closed.",
      embeds: [],
      components: [],
    });
    return;
  }

  if (action === "reset") {
    if (!session) return interaction.reply({ content: "❌ No active session.", ephemeral: true });
    session.data = { fields: [], color: 0x5865f2 };
    setSession(session);
    await refreshUI(client, session, interaction, true);
    return;
  }

  if (!session) {
    return interaction.reply({ content: "❌ Session expired. Run `embed create` to start a new one.", ephemeral: true });
  }

  // ── timestamp toggle ───────────────────────────────────────────────────────
  if (action === "timestamp") {
    session.data.timestamp = !session.data.timestamp;
    setSession(session);
    await refreshUI(client, session, interaction, true);
    return;
  }

  // ── remove field ──────────────────────────────────────────────────────────
  if (action === "rmfield") {
    const idx = parseInt(parts[3], 10);
    if (!isNaN(idx) && idx >= 0 && idx < session.data.fields.length) {
      session.data.fields.splice(idx, 1);
      setSession(session);
    }
    await refreshUI(client, session, interaction, true);
    return;
  }

  // ── inline toggle for field ───────────────────────────────────────────────
  if (action === "inlinefield") {
    const idx = parseInt(parts[3], 10);
    if (!isNaN(idx) && session.data.fields[idx]) {
      session.data.fields[idx].inline = !session.data.fields[idx].inline;
      setSession(session);
    }
    await refreshUI(client, session, interaction, true);
    return;
  }

  // ── fields list ────────────────────────────────────────────────────────────
  if (action === "fields") {
    const fields = session.data.fields;
    if (!fields.length) {
      return interaction.reply({ content: "📭 No fields yet. Click **Add Field** to add one.", ephemeral: true });
    }

    const maxShow = 5;
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let i = 0; i < Math.min(fields.length, maxShow); i++) {
      const f = fields[i];
      const label = f.name.slice(0, 20) || `Field ${i + 1}`;
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`eb:editfield:${userId}:${i}`)
            .setLabel(`✏️ ${label}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`eb:inlinefield:${userId}:${i}`)
            .setLabel(f.inline ? "⬜ Block" : "⬛ Inline")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`eb:rmfield:${userId}:${i}`)
            .setLabel("🗑️ Remove")
            .setStyle(ButtonStyle.Danger),
        ),
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Fields (${fields.length}/25)`)
      .setColor(0x5865f2)
      .setDescription(
        fields.map((f, i) =>
          `**${i + 1}.** ${f.name.slice(0, 40)} — ${f.inline ? "inline" : "block"}`
        ).join("\n")
      )
      .setFooter({ text: fields.length > maxShow ? `Showing first ${maxShow}. Use embed create to reorder.` : "" });

    return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  }

  // ── export JSON ────────────────────────────────────────────────────────────
  if (action === "export") {
    const json = JSON.stringify(embedDataToDiscohookJson(session.data), null, 2);
    if (json.length <= 1990) {
      return interaction.reply({ content: `\`\`\`json\n${json}\n\`\`\``, ephemeral: true });
    }
    const buf = Buffer.from(json, "utf8");
    const { AttachmentBuilder } = await import("discord.js");
    return interaction.reply({ files: [new AttachmentBuilder(buf, { name: "embed.json" })], ephemeral: true });
  }

  // ── send ───────────────────────────────────────────────────────────────────
  if (action === "send") {
    const settings = await getEmbedSettings(guildId);
    const modal = new ModalBuilder()
      .setCustomId(`ebm:send:${userId}`)
      .setTitle("Send Embed");
    const channelInput = new TextInputBuilder()
      .setCustomId("channel")
      .setLabel("Channel ID or mention (blank = this channel)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder("e.g. 123456789012345678");
    const editInput = new TextInputBuilder()
      .setCustomId("editid")
      .setLabel("Edit message ID (leave blank to send new)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(session.editMessageId ?? "");
    const whName = new TextInputBuilder()
      .setCustomId("whname")
      .setLabel("Webhook username (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(80);
    const whAvatar = new TextInputBuilder()
      .setCustomId("whavatar")
      .setLabel("Webhook avatar URL (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(editInput),
      ...(settings.webhookEnabled ? [
        new ActionRowBuilder<TextInputBuilder>().addComponents(whName),
        new ActionRowBuilder<TextInputBuilder>().addComponents(whAvatar),
      ] : []),
    );
    return interaction.showModal(modal);
  }

  // ── save template ──────────────────────────────────────────────────────────
  if (action === "save") {
    const modal = new ModalBuilder()
      .setCustomId(`ebm:save:${userId}`)
      .setTitle("Save Template");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("name")
          .setLabel("Template name")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(50)
          .setRequired(true),
      ),
    );
    return interaction.showModal(modal);
  }

  // ── modals for text fields ─────────────────────────────────────────────────

  if (action === "title") {
    const modal = new ModalBuilder().setCustomId(`ebm:title:${userId}`).setTitle("Title & URL");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("title").setLabel("Title (leave blank to remove)")
          .setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(false).setValue(session.data.title ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("url").setLabel("Clickable URL on title (optional)")
          .setStyle(TextInputStyle.Short).setRequired(false).setValue(session.data.url ?? ""),
      ),
    );
    return interaction.showModal(modal);
  }

  if (action === "desc") {
    const modal = new ModalBuilder().setCustomId(`ebm:desc:${userId}`).setTitle("Description");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("description").setLabel("Description (leave blank to remove)")
          .setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(false)
          .setValue(session.data.description ?? ""),
      ),
    );
    return interaction.showModal(modal);
  }

  if (action === "color") {
    const modal = new ModalBuilder().setCustomId(`ebm:color:${userId}`).setTitle("Embed Color");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("color").setLabel("Hex (#5865F2) or name (red, blue, gold…)")
          .setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(false)
          .setValue(session.data.color !== undefined ? `#${session.data.color.toString(16).padStart(6, "0")}` : ""),
      ),
    );
    return interaction.showModal(modal);
  }

  if (action === "author") {
    const modal = new ModalBuilder().setCustomId(`ebm:author:${userId}`).setTitle("Author");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("Author name (blank to remove)")
          .setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(false).setValue(session.data.authorName ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("icon").setLabel("Author icon URL (optional)")
          .setStyle(TextInputStyle.Short).setRequired(false).setValue(session.data.authorIconUrl ?? ""),
      ),
    );
    return interaction.showModal(modal);
  }

  if (action === "footer") {
    const modal = new ModalBuilder().setCustomId(`ebm:footer:${userId}`).setTitle("Footer");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("text").setLabel("Footer text (blank to remove)")
          .setStyle(TextInputStyle.Short).setMaxLength(2048).setRequired(false).setValue(session.data.footerText ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("icon").setLabel("Footer icon URL (optional)")
          .setStyle(TextInputStyle.Short).setRequired(false).setValue(session.data.footerIconUrl ?? ""),
      ),
    );
    return interaction.showModal(modal);
  }

  if (action === "thumbnail") {
    const modal = new ModalBuilder().setCustomId(`ebm:thumbnail:${userId}`).setTitle("Thumbnail");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("url").setLabel("Thumbnail image URL (blank to remove)")
          .setStyle(TextInputStyle.Short).setRequired(false).setValue(session.data.thumbnail ?? ""),
      ),
    );
    return interaction.showModal(modal);
  }

  if (action === "image") {
    const modal = new ModalBuilder().setCustomId(`ebm:image:${userId}`).setTitle("Main Image");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("url").setLabel("Large image URL (blank to remove)")
          .setStyle(TextInputStyle.Short).setRequired(false).setValue(session.data.image ?? ""),
      ),
    );
    return interaction.showModal(modal);
  }

  if (action === "addfield") {
    if (session.data.fields.length >= 25) {
      return interaction.reply({ content: "❌ Maximum 25 fields reached.", ephemeral: true });
    }
    const modal = new ModalBuilder().setCustomId(`ebm:addfield:${userId}`).setTitle("Add Field");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("Field name").setStyle(TextInputStyle.Short)
          .setMaxLength(256).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("value").setLabel("Field value").setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1024).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("inline").setLabel('Inline? Type "yes" for inline, "no" for full width')
          .setStyle(TextInputStyle.Short).setRequired(false).setValue("no"),
      ),
    );
    return interaction.showModal(modal);
  }

  if (action === "editfield") {
    const idx = parseInt(parts[3], 10);
    const field = session.data.fields[idx];
    if (!field) return interaction.reply({ content: "❌ Field not found.", ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`ebm:editfield:${userId}:${idx}`).setTitle(`Edit Field ${idx + 1}`);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("Field name").setStyle(TextInputStyle.Short)
          .setMaxLength(256).setRequired(true).setValue(field.name),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("value").setLabel("Field value").setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1024).setRequired(true).setValue(field.value),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("inline").setLabel('Inline? "yes" or "no"')
          .setStyle(TextInputStyle.Short).setRequired(false).setValue(field.inline ? "yes" : "no"),
      ),
    );
    return interaction.showModal(modal);
  }
}

// ── Handle modal submissions ──────────────────────────────────────────────────

async function handleModal(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const userId = parts[2];
  const guildId = interaction.guildId!;
  const session = getSession(userId, guildId);

  if (!session) {
    return interaction.reply({ content: "❌ Session expired. Run `embed create` to start over.", ephemeral: true });
  }

  const get = (key: string) => {
    try { return interaction.fields.getTextInputValue(key).trim(); } catch { return ""; }
  };

  if (action === "title") {
    session.data.title = get("title") || undefined;
    session.data.url = get("url") || undefined;
  } else if (action === "desc") {
    session.data.description = get("description") || undefined;
  } else if (action === "color") {
    const raw = get("color");
    if (!raw) { session.data.color = undefined; }
    else {
      const c = parseColor(raw);
      if (c === null) {
        await interaction.reply({ content: "❌ Invalid color. Use hex like `#ff0000` or a name like `red`.", ephemeral: true });
        return;
      }
      session.data.color = c;
    }
  } else if (action === "author") {
    session.data.authorName = get("name") || undefined;
    session.data.authorIconUrl = get("icon") || undefined;
  } else if (action === "footer") {
    session.data.footerText = get("text") || undefined;
    session.data.footerIconUrl = get("icon") || undefined;
  } else if (action === "thumbnail") {
    session.data.thumbnail = get("url") || undefined;
  } else if (action === "image") {
    session.data.image = get("url") || undefined;
  } else if (action === "addfield") {
    const name = get("name");
    const value = get("value");
    const inline = get("inline").toLowerCase().startsWith("y");
    if (name && value) session.data.fields.push({ name, value, inline });
  } else if (action === "editfield") {
    const idx = parseInt(parts[3], 10);
    if (!isNaN(idx) && session.data.fields[idx]) {
      session.data.fields[idx] = {
        name: get("name") || session.data.fields[idx].name,
        value: get("value") || session.data.fields[idx].value,
        inline: get("inline").toLowerCase().startsWith("y"),
      };
    }
  } else if (action === "save") {
    const name = get("name");
    if (!name) {
      return interaction.reply({ content: "❌ Template name cannot be empty.", ephemeral: true });
    }
    const settings = await getEmbedSettings(guildId);
    const templates = await getTemplates(guildId);
    if (Object.keys(templates).length >= settings.maxTemplates && !templates[name.toLowerCase()]) {
      return interaction.reply({ content: `❌ Max ${settings.maxTemplates} templates reached.`, ephemeral: true });
    }
    await saveTemplate(guildId, name, {
      name, creatorId: userId,
      data: { ...session.data, fields: [...session.data.fields] },
      createdAt: Date.now(),
    });
    await interaction.reply({ content: `✅ Template **${name}** saved!`, ephemeral: true });
    await refreshUI(client, session, interaction, false);
    return;
  } else if (action === "send") {
    const rawChannel = get("channel");
    const editId = get("editid");
    const whName = get("whname");
    const whAvatar = get("whavatar");

    const chId = rawChannel.replace(/[<#>]/g, "") || interaction.channelId;
    const ch = (interaction.guild?.channels.cache.get(chId) ?? null) as TextChannel | null;
    if (!ch?.isTextBased()) {
      return interaction.reply({ content: "❌ Channel not found or not a text channel.", ephemeral: true });
    }

    const settings = await getEmbedSettings(guildId);
    if (settings.allowedChannels.length && !settings.allowedChannels.includes(ch.id)) {
      return interaction.reply({ content: "❌ That channel is not allowed.", ephemeral: true });
    }

    const embed = buildPreviewEmbed(session.data);

    try {
      if (editId) {
        const target = await (ch as any).messages.fetch(editId).catch(() => null);
        if (!target) return interaction.reply({ content: "❌ Message not found.", ephemeral: true });
        await target.edit({ embeds: [embed] });
        await interaction.reply({ content: `✅ Embed edited in <#${ch.id}>.`, ephemeral: true });
      } else if (whName && settings.webhookEnabled) {
        const webhooks = await (ch as any).fetchWebhooks?.().catch(() => null);
        let wh = webhooks?.find((w: any) => w.owner?.id === client.user?.id);
        if (!wh) {
          wh = await (ch as any).createWebhook?.({ name: "EmbedBuilder", reason: "Embed builder send" }).catch(() => null);
        }
        if (wh) {
          await wh.send({ embeds: [embed], username: whName.slice(0, 80), avatarURL: whAvatar || undefined });
          await interaction.reply({ content: `✅ Sent via webhook as **${whName}** to <#${ch.id}>.`, ephemeral: true });
        } else {
          return interaction.reply({ content: "❌ Could not create webhook. Check my permissions.", ephemeral: true });
        }
      } else {
        await (ch as any).send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Embed sent to <#${ch.id}>.`, ephemeral: true });
      }

      // Log
      const logCh = settings.logChannelId ? interaction.guild?.channels.cache.get(settings.logChannelId) as TextChannel | null : null;
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x5865f2).setTitle("📋 Embed Builder Log")
          .addFields(
            { name: "User", value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
            { name: "Action", value: editId ? "Edited embed" : whName ? `Sent via webhook "${whName}"` : "Sent embed", inline: true },
            { name: "Channel", value: `<#${ch.id}>`, inline: true },
          ).setTimestamp();
        await logCh.send({ embeds: [logEmbed] }).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err }, "Embed send error");
      await interaction.reply({ content: "❌ Failed to send. Check my permissions.", ephemeral: true });
    }
    await refreshUI(client, session, interaction, false);
    return;
  }

  setSession(session);
  await refreshUI(client, session, interaction, false);
}

// ── Register ──────────────────────────────────────────────────────────────────

export function registerEmbedButtons(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith("eb:")) {
        await handleButton(interaction as ButtonInteraction, client);
      } else if (interaction.isModalSubmit() && interaction.customId.startsWith("ebm:")) {
        await handleModal(interaction as ModalSubmitInteraction, client);
      }
    } catch (err) {
      logger.error({ err }, "Embed builder interaction error");
      const i = interaction as any;
      if (i.replied || i.deferred) {
        await i.followUp({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
      } else {
        await i.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
      }
    }
  });
}
