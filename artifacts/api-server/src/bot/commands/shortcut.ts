import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  setShortcut,
  deleteShortcut,
  listShortcuts,
  type ShortcutType,
} from "../store/shortcuts";

const VALID_TYPES: ShortcutType[] = ["warn", "mute", "kick", "ban"];

const DURATION_RE = /^(\d+)(s|m|h|d)$/i;

const TYPE_COLORS: Record<ShortcutType, number> = {
  warn: 0xf1c40f,
  mute: 0xf39c12,
  kick: 0xe67e22,
  ban: 0xe74c3c,
};

const TYPE_EMOJIS: Record<ShortcutType, string> = {
  warn: "⚠️",
  mute: "🔇",
  kick: "👢",
  ban: "🔨",
};

export const shortcutCommand: Command = {
  name: "shortcut",
  aliases: ["sc"],
  description: "Create shortcut punishment commands",
  usage:
    "warn|mute|kick|ban <name> [duration (mute only)] <reason>  |  list  |  delete <name>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;

    const sub = args[0]?.toLowerCase();

    if (!sub) {
      return message.reply(usageErr(message, shortcutCommand, "Provide a subcommand"));
    }

    if (sub === "list") {
      const shortcuts = listShortcuts(guildId);
      if (!shortcuts.length) return message.reply("No shortcuts configured yet.");

      const lines = shortcuts.map((s) => {
        const base = `${TYPE_EMOJIS[s.type]} **${s.name}** → ${s.type}`;
        const dur = s.duration ? ` (${s.duration})` : "";
        return `${base}${dur} — ${s.reason}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Shortcuts")
        .setDescription(lines.join("\n"));

      return message.reply({ embeds: [embed] });
    }

    if (sub === "delete" || sub === "del" || sub === "remove") {
      const name = args[1]?.toLowerCase();
      if (!name) return message.reply(usageErr(message, shortcutCommand, "Provide a shortcut name to delete"));
      const removed = deleteShortcut(guildId, name);
      return message.reply(removed ? `✅ Deleted shortcut \`${name}\`.` : `❌ No shortcut named \`${name}\`.`);
    }

    if ((VALID_TYPES as string[]).includes(sub)) {
      const type = sub as ShortcutType;
      const name = args[1]?.toLowerCase();
      if (!name) return message.reply(usageErr(message, shortcutCommand, "Provide a name for the shortcut"));

      const existing = listShortcuts(guildId);
      const isUpdate = existing.some((s) => s.name === name);
      if (!isUpdate && existing.length >= 50) {
        return message.reply("❌ You've reached the limit of **50 shortcuts**. Delete one first with `>shortcut delete <name>`.");
      }

      if (type === "mute") {
        const durationArg = args[2];
        if (!durationArg || !DURATION_RE.test(durationArg)) {
          return message.reply(usageErr(message, shortcutCommand, "Mute shortcuts require a duration as the third argument (e.g. 5m, 2h, 1d)"));
        }
        const reason = args.slice(3).join(" ");
        if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
        setShortcut(guildId, { name, type, reason, duration: durationArg });
        return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will mute for **${durationArg}**: *${reason}*`);
      } else if (type === "ban") {
        // Duration is optional for bans
        const maybeDuration = args[2];
        const hasDuration = maybeDirection => DURATION_RE.test(maybeDirection ?? "");
        if (hasDuration(maybeDuration)) {
          const reason = args.slice(3).join(" ");
          if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
          setShortcut(guildId, { name, type, reason, duration: maybeDuration });
          return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will ban for **${maybeDuration}**: *${reason}*`);
        } else {
          const reason = args.slice(2).join(" ");
          if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
          setShortcut(guildId, { name, type, reason });
          return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will permanently ban: *${reason}*`);
        }
      } else {
        const reason = args.slice(2).join(" ");
        if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
        setShortcut(guildId, { name, type, reason });
        return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will ${type}: *${reason}*`);
      }
    }

    return message.reply(usageErr(message, shortcutCommand, "Invalid subcommand — use warn, mute, kick, ban, list, or delete"));
  },
};
