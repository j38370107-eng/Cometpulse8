import type { Command } from "../types";
import { PermissionFlagsBits, AttachmentBuilder } from "discord.js";
import { exportGuildXp, importGuildXp } from "../../store/levels";

export const xpExportCommand: Command = {
  name: "xpexport",
  aliases: ["exportxp", "exportlevels"],
  description: "Export all XP data as a JSON file. (Admin only)",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message) {
    if (!message.guild) return;

    const data = exportGuildXp(message.guild.id);
    if (data.length === 0) {
      return message.reply("❌ No XP data to export.");
    }

    const json = JSON.stringify({ guild: message.guild.id, exported: Date.now(), entries: data }, null, 2);
    const buf = Buffer.from(json, "utf8");
    const attachment = new AttachmentBuilder(buf, { name: `xp-export-${message.guild.id}.json` });
    return message.channel.send({
      content: `✅ Exported **${data.length}** user records.`,
      files: [attachment],
    });
  },
};

export const xpImportCommand: Command = {
  name: "xpimport",
  aliases: ["importxp", "importlevels"],
  description: "Import XP data from a JSON file attachment. (Admin only)",
  usage: "[attach JSON file]",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message) {
    if (!message.guild) return;

    const attachment = message.attachments.first();
    if (!attachment || !attachment.url) {
      return message.reply("❌ Please attach a JSON export file.");
    }

    if (!attachment.name?.endsWith(".json")) {
      return message.reply("❌ Attachment must be a `.json` file from `xpexport`.");
    }

    try {
      const res = await fetch(attachment.url);
      const raw = await res.text();
      const parsed = JSON.parse(raw);
      const entries = parsed.entries ?? parsed;
      if (!Array.isArray(entries)) {
        return message.reply("❌ Invalid format. Expected `{ entries: [...] }` or an array.");
      }
      const count = importGuildXp(message.guild.id, entries);
      return message.reply(`✅ Imported XP for **${count}** users.`);
    } catch {
      return message.reply("❌ Failed to parse the JSON file.");
    }
  },
};
