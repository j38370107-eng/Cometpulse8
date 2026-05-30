import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { RolePanel } from "../store/rolePanel";

const BTN_STYLE_MAP: Record<string, ButtonStyle> = {
  PRIMARY: ButtonStyle.Primary,
  SECONDARY: ButtonStyle.Secondary,
  SUCCESS: ButtonStyle.Success,
  DANGER: ButtonStyle.Danger,
};

const MODE_NOTE: Record<string, string> = {
  toggle: "Click a role to add it. Click again to remove it.",
  exclusive: "You may only hold **one** role from this panel at a time.",
  verify: "Click once to permanently claim your role.",
  reversed: "Roles are opt-out — click to remove a role you currently hold.",
};

export function buildPanelEmbed(panel: RolePanel): EmbedBuilder {
  const color = parseInt(panel.color.replace("#", ""), 16) || 0x7c3cfa;
  const embed = new EmbedBuilder().setColor(color);

  if (panel.title) embed.setTitle(panel.title);
  if (panel.description) embed.setDescription(panel.description);
  if (panel.thumbnail) embed.setThumbnail(panel.thumbnail);
  if (panel.image) embed.setImage(panel.image);
  if (panel.footer) embed.setFooter({ text: panel.footer });

  const note = MODE_NOTE[panel.mode];
  if (note) embed.addFields({ name: "\u200b", value: `*${note}*` });

  return embed;
}

export function buildPanelComponents(panel: RolePanel): ActionRowBuilder<any>[] {
  if (panel.type === "button") {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let row = new ActionRowBuilder<ButtonBuilder>();
    let col = 0;

    for (const role of panel.roles.slice(0, 25)) {
      if (col > 0 && col % 5 === 0) {
        rows.push(row);
        row = new ActionRowBuilder<ButtonBuilder>();
        if (rows.length >= 4) break;
      }
      const btn = new ButtonBuilder()
        .setCustomId(`rp:btn:${panel.id}:${role.roleId}`)
        .setLabel(role.label || "Role")
        .setStyle(BTN_STYLE_MAP[role.buttonStyle] ?? ButtonStyle.Secondary);
      if (role.emoji) {
        try { btn.setEmoji(role.emoji); } catch {}
      }
      row.addComponents(btn);
      col++;
    }
    if (col % 5 !== 0 || col === 0) rows.push(row);
    return rows.slice(0, 5);
  }

  if (panel.type === "dropdown") {
    const options = panel.roles.slice(0, 25).map((role) => {
      const opt = new StringSelectMenuOptionBuilder()
        .setValue(role.roleId)
        .setLabel((role.label || "Role").slice(0, 100));
      if (role.description) opt.setDescription(role.description.slice(0, 100));
      if (role.emoji) {
        try { opt.setEmoji(role.emoji); } catch {}
      }
      return opt;
    });

    if (options.length === 0) return [];

    const maxV = panel.mode === "exclusive" ? 1 : Math.min(panel.roles.length, 25);
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`rp:sel:${panel.id}`)
      .setPlaceholder(panel.mode === "exclusive" ? "Select one role…" : "Select role(s)…")
      .addOptions(options)
      .setMinValues(0)
      .setMaxValues(Math.max(1, maxV));

    return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
  }

  return [];
}
