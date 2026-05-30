import type { Command } from "../types";
import { EmbedBuilder, PermissionFlagsBits, TextChannel } from "discord.js";
import { getGuildPanels, getPanel, savePanel } from "../../store/rolePanel";
import { buildPanelEmbed, buildPanelComponents } from "../../rolePanel/builder";
import { messagePanelIndex } from "../../store/rolePanel";

const TYPE_LABEL: Record<string, string> = { button: "🔘 Button", dropdown: "📋 Dropdown", reaction: "😀 Reaction" };
const MODE_LABEL: Record<string, string> = { toggle: "Toggle", exclusive: "Exclusive", verify: "Verify", reversed: "Reversed" };

export const rpCommand: Command = {
  name: "rp",
  aliases: ["rolepanel", "relpanel"],
  description: "Manage role panels. Subcommands: list, post <id>, repost <id>",
  usage: "<list | post <id> | repost <id>>",
  requiredPermissions: [PermissionFlagsBits.ManageRoles],
  async execute(message, args) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── list ──────────────────────────────────────────────────────────────────
    if (!sub || sub === "list") {
      const panels = Object.values(getGuildPanels(guildId));
      if (panels.length === 0) {
        return message.reply("📋 No role panels configured. Create one in the dashboard.");
      }
      const lines = panels.map((p) => {
        const status = p.messageId ? "✅ Posted" : "⏳ Draft";
        return `**${p.title || "Untitled"}** — \`${p.id.slice(0, 8)}\` | ${TYPE_LABEL[p.type] ?? p.type} | ${MODE_LABEL[p.mode] ?? p.mode} | ${p.roles.length} roles | ${status}`;
      });
      const embed = new EmbedBuilder()
        .setColor(0x7c3cfa)
        .setTitle(`Role Panels — ${message.guild.name}`)
        .setDescription(lines.join("\n") || "None");
      return message.channel.send({ embeds: [embed] });
    }

    const panelId = args[1];
    if (!panelId) return message.reply("❌ Please provide a panel ID. Use `c!rp list` to see panel IDs.");

    const idMatch = Object.keys(getGuildPanels(guildId)).find((id) => id.startsWith(panelId) || id === panelId);
    const panel = idMatch ? getPanel(guildId, idMatch) : null;
    if (!panel) return message.reply(`❌ Panel \`${panelId}\` not found. Use \`c!rp list\` to see all panels.`);

    // ── post ─────────────────────────────────────────────────────────────────
    if (sub === "post" || sub === "repost") {
      if (!panel.channelId) return message.reply("❌ This panel has no channel set. Configure it in the dashboard.");
      if (!panel.roles.length) return message.reply("❌ This panel has no roles added yet.");

      const ch = message.guild.channels.cache.get(panel.channelId) as TextChannel | undefined;
      if (!ch?.isTextBased()) return message.reply("❌ The configured channel is missing or not a text channel.");

      const embed = buildPanelEmbed(panel);
      const components = buildPanelComponents(panel);

      try {
        const msg = await (ch as TextChannel).send({ embeds: [embed], components });

        // Add reactions for reaction-type panels
        if (panel.type === "reaction") {
          for (const role of panel.roles) {
            if (role.emoji) await msg.react(role.emoji).catch(() => {});
          }
        }

        const updated = { ...panel, messageId: msg.id };
        savePanel(updated);
        messagePanelIndex.set(msg.id, { guildId, panelId: panel.id });

        return message.reply(`✅ Panel **${panel.title || "Untitled"}** posted in <#${ch.id}>.`);
      } catch (err: any) {
        return message.reply(`❌ Failed to post panel: ${err.message}`);
      }
    }

    return message.reply(`❓ Unknown subcommand \`${sub}\`. Use: \`list\`, \`post <id>\`, \`repost <id>\``);
  },
};
