import {
  Message, EmbedBuilder, TextChannel, PermissionFlagsBits, GuildMember,
} from "discord.js";
import type { Command } from "../types";
import {
  getSession, setSession, deleteSession, createEmptySession,
  getTemplates, saveTemplate, deleteTemplate,
  getScheduledEmbeds, saveScheduledEmbed, deleteScheduledEmbed,
  getEmbedSettings, setEmbedSettings, DEFAULT_EMBED_SETTINGS,
  EmbedData,
} from "../../store/embedBuilder";
import {
  buildPreviewEmbed, buildBuilderRows, discordEmbedToData, PRESETS,
  embedDataToDiscohookJson, discohookJsonToEmbedData, parseTime, BUILDER_CONTENT,
} from "../../lib/embedBuilderUtils";

async function canUseBuilder(message: Message): Promise<boolean> {
  if (!message.guild || !message.member) return false;
  if ((message.member as GuildMember).permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  const settings = await getEmbedSettings(message.guild.id);
  if (settings.requiredRole && !(message.member as GuildMember).roles.cache.has(settings.requiredRole)) return false;
  return true;
}

async function showBuilder(message: Message, data: EmbedData, editMessageId?: string): Promise<void> {
  if (!message.guild) return;
  const userId = message.author.id;
  const guildId = message.guild.id;

  const session = createEmptySession(userId, guildId, message.channelId);
  session.data = data;
  session.editMessageId = editMessageId;

  const embed = buildPreviewEmbed(data);
  const rows = buildBuilderRows(userId, data.fields.length);

  const msg = await message.channel.send({ content: BUILDER_CONTENT, embeds: [embed], components: rows });
  session.builderMessageId = msg.id;
  setSession(session);
}

export const embedCommand: Command = {
  name: "embed",
  aliases: ["eb"],
  description: "Interactive embed builder with templates, scheduling, and webhook support",
  usage: "embed <create|edit|copy|send|template|schedule|scheduled|json|preview|settings|reset|help> [args]",

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    if (!await canUseBuilder(message)) {
      return message.reply("❌ You don't have permission to use the embed builder.");
    }

    const sub = args[0]?.toLowerCase();
    const guildId = message.guild.id;
    const userId = message.author.id;

    // ── create ────────────────────────────────────────────────────────────────
    if (!sub || sub === "create" || sub === "new") {
      const presetName = args[1]?.toLowerCase();
      const preset = presetName && PRESETS[presetName];
      const data: EmbedData = preset
        ? { ...preset, fields: [...preset.fields] }
        : { fields: [], color: 0x5865f2 };

      await showBuilder(message, data);

      if (preset) {
        await message.reply(`✅ Loaded **${presetName}** preset. Customize it with the buttons!`);
      }
      return;
    }

    // ── presets list ──────────────────────────────────────────────────────────
    if (sub === "presets") {
      const list = Object.keys(PRESETS).map(p => `\`${p}\``).join(", ");
      return message.reply(`📋 Available presets: ${list}\n\nUse \`embed create <preset>\` to load one.`);
    }

    // ── edit / copy ───────────────────────────────────────────────────────────
    if (sub === "edit" || sub === "copy") {
      const msgId = args[1];
      if (!msgId) return message.reply("❌ Provide a message ID.");

      const target = await (message.channel as TextChannel).messages.fetch(msgId).catch(() => null);
      if (!target) return message.reply("❌ Message not found in this channel.");
      const srcEmbed = target.embeds[0];
      if (!srcEmbed) return message.reply("❌ That message has no embed.");

      const data = discordEmbedToData(srcEmbed);
      const editId = sub === "edit" ? msgId : undefined;
      await showBuilder(message, data, editId);
      return;
    }

    // ── preview ───────────────────────────────────────────────────────────────
    if (sub === "preview") {
      const session = getSession(userId, guildId);
      if (!session) return message.reply("❌ No active session. Run `embed create` first.");
      const embed = buildPreviewEmbed(session.data);
      return message.reply({ content: "👁️ Preview:", embeds: [embed] });
    }

    // ── reset ─────────────────────────────────────────────────────────────────
    if (sub === "reset") {
      deleteSession(userId, guildId);
      return message.reply("✅ Session cleared.");
    }

    // ── send ──────────────────────────────────────────────────────────────────
    if (sub === "send") {
      const session = getSession(userId, guildId);
      if (!session) return message.reply("❌ No active session. Run `embed create` first.");

      const ch = message.mentions.channels.first() as TextChannel | null
        ?? (message.channel as TextChannel);

      const settings = await getEmbedSettings(guildId);
      if (settings.allowedChannels.length && !settings.allowedChannels.includes(ch.id)) {
        return message.reply("❌ That channel is not in the allowed list.");
      }

      try {
        const embed = buildPreviewEmbed(session.data);
        if (session.editMessageId) {
          const target = await ch.messages.fetch(session.editMessageId).catch(() => null);
          if (!target) return message.reply("❌ Original message not found.");
          await target.edit({ embeds: [embed] });
          await message.reply(`✅ Embed updated in ${ch}.`);
        } else {
          await ch.send({ embeds: [embed] });
          await message.reply(`✅ Embed sent to ${ch}.`);
        }
        await logEmbed(message, ch.id, "sent");
      } catch {
        await message.reply("❌ Failed to send embed. Check my permissions in that channel.");
      }
      return;
    }

    // ── template ──────────────────────────────────────────────────────────────
    if (sub === "template") {
      const action = args[1]?.toLowerCase();

      if (action === "save") {
        const name = args.slice(2).join(" ").trim();
        if (!name) return message.reply("❌ Provide a template name.");
        const session = getSession(userId, guildId);
        if (!session) return message.reply("❌ No active session. Run `embed create` first.");

        const settings = await getEmbedSettings(guildId);
        const templates = await getTemplates(guildId);
        if (Object.keys(templates).length >= settings.maxTemplates) {
          return message.reply(`❌ Max ${settings.maxTemplates} templates reached.`);
        }

        await saveTemplate(guildId, name, {
          name,
          creatorId: userId,
          data: { ...session.data, fields: [...session.data.fields] },
          createdAt: Date.now(),
        });
        await logEmbed(message, guildId, `saved template "${name}"`);
        return message.reply(`✅ Template **${name}** saved.`);
      }

      if (action === "load") {
        const name = args.slice(2).join(" ").trim().toLowerCase();
        if (!name) return message.reply("❌ Provide a template name.");
        const templates = await getTemplates(guildId);
        const tmpl = templates[name];
        if (!tmpl) return message.reply(`❌ No template named \`${name}\`. Run \`embed template list\` to see all.`);
        await showBuilder(message, { ...tmpl.data, fields: [...tmpl.data.fields] });
        return;
      }

      if (action === "list") {
        const templates = await getTemplates(guildId);
        const names = Object.values(templates);
        if (!names.length) return message.reply("📭 No templates saved yet.");
        const embed = new EmbedBuilder()
          .setTitle("💾 Saved Templates")
          .setColor(0x5865f2)
          .setDescription(names.map(t => `**${t.name}** — saved <t:${Math.floor(t.createdAt / 1000)}:R>`).join("\n"))
          .setFooter({ text: `${names.length} template(s)` });
        return message.reply({ embeds: [embed] });
      }

      if (action === "delete") {
        const name = args.slice(2).join(" ").trim();
        if (!name) return message.reply("❌ Provide a template name.");
        const deleted = await deleteTemplate(guildId, name);
        if (!deleted) return message.reply(`❌ No template named \`${name}\`.`);
        await logEmbed(message, guildId, `deleted template "${name}"`);
        return message.reply(`✅ Template **${name}** deleted.`);
      }

      return message.reply("❓ Usage: `embed template <save|load|list|delete> [name]`");
    }

    // ── schedule ──────────────────────────────────────────────────────────────
    if (sub === "schedule") {
      const session = getSession(userId, guildId);
      if (!session) return message.reply("❌ No active session. Run `embed create` first.");

      const ch = message.mentions.channels.first() as TextChannel | null;
      if (!ch) return message.reply("❌ Mention the channel to schedule to. Example: `embed schedule #announcements 1h`");

      const timeStr = args.slice(2).filter(a => !a.startsWith("--")).join(" ");
      if (!timeStr) return message.reply("❌ Provide a time. Example: `embed schedule #channel 1h` or `2025-12-25 12:00`");

      const sendAt = parseTime(timeStr);
      if (!sendAt || sendAt.getTime() <= Date.now()) {
        return message.reply("❌ Invalid or past time. Use e.g. `1h`, `30m`, `2025-12-25 20:00`");
      }

      const recurring = args.includes("--daily") ? "daily"
        : args.includes("--weekly") ? "weekly"
        : args.includes("--monthly") ? "monthly"
        : undefined;

      const settings = await getEmbedSettings(guildId);
      const all = await getScheduledEmbeds(guildId);
      if (Object.keys(all).length >= settings.maxScheduled) {
        return message.reply(`❌ Max ${settings.maxScheduled} scheduled embeds reached. Cancel one first.`);
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await saveScheduledEmbed(guildId, {
        id, creatorId: userId, guildId,
        channelId: ch.id,
        data: { ...session.data, fields: [...session.data.fields] },
        sendAt: sendAt.getTime(),
        recurring,
      });

      const recStr = recurring ? ` (recurring **${recurring}**)` : "";
      return message.reply(`✅ Embed scheduled for <t:${Math.floor(sendAt.getTime() / 1000)}:F> in ${ch}${recStr}.\nID: \`${id}\``);
    }

    // ── scheduled ─────────────────────────────────────────────────────────────
    if (sub === "scheduled") {
      const action = args[1]?.toLowerCase();

      if (!action || action === "list") {
        const all = await getScheduledEmbeds(guildId);
        const list = Object.values(all);
        if (!list.length) return message.reply("📭 No scheduled embeds.");
        const embed = new EmbedBuilder()
          .setTitle("🕐 Scheduled Embeds")
          .setColor(0x5865f2)
          .setDescription(list.map(s =>
            `**\`${s.id}\`** → <#${s.channelId}> @ <t:${Math.floor(s.sendAt / 1000)}:F>${s.recurring ? ` *(${s.recurring})*` : ""}`
          ).join("\n"))
          .setFooter({ text: `${list.length} scheduled` });
        return message.reply({ embeds: [embed] });
      }

      if (action === "cancel") {
        const id = args[2];
        if (!id) return message.reply("❌ Provide the schedule ID from `embed scheduled list`.");
        const deleted = await deleteScheduledEmbed(guildId, id);
        return message.reply(deleted ? `✅ Schedule \`${id}\` cancelled.` : "❌ Schedule not found.");
      }

      return message.reply("❓ Usage: `embed scheduled <list|cancel> [id]`");
    }

    // ── json ──────────────────────────────────────────────────────────────────
    if (sub === "json") {
      const action = args[1]?.toLowerCase();

      if (action === "export") {
        const session = getSession(userId, guildId);
        if (!session) return message.reply("❌ No active session. Run `embed create` first.");
        const json = JSON.stringify(embedDataToDiscohookJson(session.data), null, 2);
        if (json.length <= 1990) {
          return message.reply(`\`\`\`json\n${json}\n\`\`\``);
        }
        const buf = Buffer.from(json, "utf8");
        const { AttachmentBuilder } = await import("discord.js");
        return message.reply({ files: [new AttachmentBuilder(buf, { name: "embed.json" })] });
      }

      if (action === "import") {
        const raw = args.slice(2).join(" ").trim();
        if (!raw) return message.reply("❌ Paste the JSON after the command. Example: `embed json import {...}`");
        let parsed: any;
        try { parsed = JSON.parse(raw); } catch { return message.reply("❌ Invalid JSON."); }
        const data = discohookJsonToEmbedData(parsed);
        if (!data) return message.reply("❌ Could not parse embed data from JSON.");
        await showBuilder(message, data);
        return;
      }

      return message.reply("❓ Usage: `embed json <export|import> [json]`");
    }

    // ── settings ──────────────────────────────────────────────────────────────
    if (sub === "settings") {
      if (!(message.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply("❌ Manage Server required.");
      }
      const settings = await getEmbedSettings(guildId);
      const action = args[1]?.toLowerCase();

      if (!action) {
        const embed = new EmbedBuilder()
          .setTitle("⚙️ Embed Builder Settings")
          .setColor(0x5865f2)
          .addFields(
            { name: "Required Role", value: settings.requiredRole ? `<@&${settings.requiredRole}>` : "None (Manage Messages)", inline: true },
            { name: "Allowed Channels", value: settings.allowedChannels.length ? settings.allowedChannels.map(c => `<#${c}>`).join(", ") : "Any", inline: true },
            { name: "Max Templates", value: String(settings.maxTemplates), inline: true },
            { name: "Max Scheduled", value: String(settings.maxScheduled), inline: true },
            { name: "Webhook Enabled", value: settings.webhookEnabled ? "✅" : "❌", inline: true },
            { name: "Variables", value: settings.variablesEnabled ? "✅" : "❌", inline: true },
            { name: "Log Channel", value: settings.logChannelId ? `<#${settings.logChannelId}>` : "None", inline: true },
          );
        return message.reply({ embeds: [embed] });
      }

      if (action === "role") {
        const role = message.mentions.roles.first();
        settings.requiredRole = role?.id;
        await setEmbedSettings(guildId, settings);
        return message.reply(role ? `✅ Required role set to ${role}.` : "✅ Required role cleared.");
      }
      if (action === "channel") {
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply("❌ Mention a channel.");
        if (!settings.allowedChannels.includes(ch.id)) {
          settings.allowedChannels.push(ch.id);
          await setEmbedSettings(guildId, settings);
          return message.reply(`✅ ${ch} added to allowed channels.`);
        }
        settings.allowedChannels = settings.allowedChannels.filter(id => id !== ch.id);
        await setEmbedSettings(guildId, settings);
        return message.reply(`✅ ${ch} removed from allowed channels.`);
      }
      if (action === "maxtemplates") {
        const n = parseInt(args[2], 10);
        if (isNaN(n) || n < 1) return message.reply("❌ Provide a positive number.");
        settings.maxTemplates = n;
        await setEmbedSettings(guildId, settings);
        return message.reply(`✅ Max templates set to **${n}**.`);
      }
      if (action === "maxscheduled") {
        const n = parseInt(args[2], 10);
        if (isNaN(n) || n < 1) return message.reply("❌ Provide a positive number.");
        settings.maxScheduled = n;
        await setEmbedSettings(guildId, settings);
        return message.reply(`✅ Max scheduled set to **${n}**.`);
      }
      if (action === "webhook") {
        settings.webhookEnabled = !settings.webhookEnabled;
        await setEmbedSettings(guildId, settings);
        return message.reply(`✅ Webhooks: **${settings.webhookEnabled ? "enabled" : "disabled"}**.`);
      }
      if (action === "variables") {
        settings.variablesEnabled = !settings.variablesEnabled;
        await setEmbedSettings(guildId, settings);
        return message.reply(`✅ Variables: **${settings.variablesEnabled ? "enabled" : "disabled"}**.`);
      }
      if (action === "logchannel") {
        const ch = message.mentions.channels.first();
        settings.logChannelId = ch?.id;
        await setEmbedSettings(guildId, settings);
        return message.reply(ch ? `✅ Log channel set to ${ch}.` : "✅ Log channel cleared.");
      }
      if (action === "reset") {
        await setEmbedSettings(guildId, { ...DEFAULT_EMBED_SETTINGS });
        return message.reply("✅ Settings reset to defaults.");
      }

      return message.reply("❓ Usage: `embed settings [role|channel|maxtemplates|maxscheduled|webhook|variables|logchannel|reset]`");
    }

    // ── help / default ────────────────────────────────────────────────────────
    const presetList = Object.keys(PRESETS).join(", ");
    const embed = new EmbedBuilder()
      .setTitle("🛠️ Embed Builder")
      .setColor(0x5865f2)
      .setDescription("Build rich Discord embeds with a live interactive preview.")
      .addFields(
        { name: "🆕 Create", value: "`embed create [preset]`\nPresets: " + presetList, inline: false },
        { name: "✏️ Edit / Copy", value: "`embed edit <messageId>` — edit existing\n`embed copy <messageId>` — copy as new", inline: false },
        { name: "📤 Send", value: "`embed send [#channel]`", inline: false },
        { name: "💾 Templates", value: "`embed template <save|load|list|delete> [name]`", inline: false },
        { name: "🕐 Schedule", value: "`embed schedule #channel <time> [--daily|--weekly|--monthly]`\n`embed scheduled <list|cancel> [id]`", inline: false },
        { name: "🔧 JSON", value: "`embed json export` — export as JSON\n`embed json import <json>` — import", inline: false },
        { name: "⚙️ Settings", value: "`embed settings` — view/configure", inline: false },
      )
      .setFooter({ text: "Variables: {server} {membercount} {user} {date} {time}" });
    return message.channel.send({ embeds: [embed] });
  },
};

async function logEmbed(message: Message, target: string, action: string): Promise<void> {
  if (!message.guild) return;
  const settings = await getEmbedSettings(message.guild.id);
  if (!settings.logChannelId) return;
  const ch = message.guild.channels.cache.get(settings.logChannelId) as TextChannel | null;
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📋 Embed Builder Log")
    .addFields(
      { name: "User", value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
      { name: "Action", value: action, inline: true },
      { name: "Target", value: target, inline: true },
    )
    .setTimestamp();
  await ch.send({ embeds: [embed] }).catch(() => {});
}
