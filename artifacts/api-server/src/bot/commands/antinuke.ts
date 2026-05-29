import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { getAntiNuke, updateAntiNuke, AntiNukeAction } from "../store/antinuke";

const VALID_ACTIONS: AntiNukeAction[] = ["ban", "kick", "strip"];
const VALID_THRESHOLDS = ["channeldelete", "channelcreate", "roledelete", "rolecreate", "ban", "kick", "webhookcreate"] as const;
type ThresholdKey = (typeof VALID_THRESHOLDS)[number];

const THRESHOLD_LABELS: Record<ThresholdKey, string> = {
  channeldelete: "channelDelete",
  channelcreate: "channelCreate",
  roledelete: "roleDelete",
  rolecreate: "roleCreate",
  ban: "ban",
  kick: "kick",
  webhookcreate: "webhookCreate",
} as const;

export const antinukeCommand: Command = {
  name: "antinuke",
  aliases: ["an", "nuke"],
  description: "Configure the anti-nuke protection system",
  usage: "enable | disable | status | action <ban|kick|strip> | threshold <type> <count> | window <seconds> | whitelist add/remove/list @user | logchannel <#channel | clear>",
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── enable / disable ──────────────────────────────────────────────────────
    if (sub === "enable" || sub === "on") {
      updateAntiNuke(guildId, { enabled: true });
      return message.reply("✅ Anti-Nuke protection **enabled**.");
    }
    if (sub === "disable" || sub === "off") {
      updateAntiNuke(guildId, { enabled: false });
      return message.reply("✅ Anti-Nuke protection **disabled**.");
    }

    // ── action ────────────────────────────────────────────────────────────────
    if (sub === "action") {
      const act = args[1]?.toLowerCase() as AntiNukeAction;
      if (!VALID_ACTIONS.includes(act)) {
        return message.reply(usageErr(message, antinukeCommand, `Invalid action — choose: ${VALID_ACTIONS.join(", ")}`));
      }
      updateAntiNuke(guildId, { action: act });
      return message.reply(`✅ Anti-Nuke action set to **${act}**.`);
    }

    // ── threshold ─────────────────────────────────────────────────────────────
    if (sub === "threshold") {
      const type = args[1]?.toLowerCase() as ThresholdKey;
      const count = parseInt(args[2] ?? "", 10);

      if (!VALID_THRESHOLDS.includes(type as ThresholdKey)) {
        return message.reply(usageErr(message, antinukeCommand, `Invalid threshold type — choose: ${VALID_THRESHOLDS.join(", ")}`));
      }
      if (isNaN(count) || count < 1 || count > 50) {
        return message.reply("❌ Threshold must be a number between 1 and 50.");
      }

      const cfg = getAntiNuke(guildId);
      const key = THRESHOLD_LABELS[type] as keyof typeof cfg.thresholds;
      cfg.thresholds[key] = count;
      updateAntiNuke(guildId, { thresholds: cfg.thresholds });
      return message.reply(`✅ **${key}** threshold set to **${count}** actions.`);
    }

    // ── window ────────────────────────────────────────────────────────────────
    if (sub === "window") {
      const secs = parseInt(args[1] ?? "", 10);
      if (isNaN(secs) || secs < 1 || secs > 120) {
        return message.reply("❌ Window must be between 1 and 120 seconds.");
      }
      updateAntiNuke(guildId, { windowMs: secs * 1000 });
      return message.reply(`✅ Anti-Nuke detection window set to **${secs}s**.`);
    }

    // ── logchannel ────────────────────────────────────────────────────────────
    if (sub === "logchannel") {
      const arg = args[1]?.toLowerCase();
      if (arg === "clear") {
        updateAntiNuke(guildId, { logChannel: undefined });
        return message.reply("✅ Anti-Nuke log channel cleared. Events will fall back to the mod log channel.");
      }
      const ch = message.mentions.channels.first() ?? (args[1] ? message.guild.channels.cache.get(args[1]) : null);
      if (!ch || !("send" in ch)) return message.reply(usageErr(message, antinukeCommand, "Mention a valid text channel"));
      updateAntiNuke(guildId, { logChannel: ch.id });
      return message.reply(`✅ Anti-Nuke events will be logged to <#${ch.id}>.`);
    }

    // ── whitelist ─────────────────────────────────────────────────────────────
    if (sub === "whitelist") {
      const wlSub = args[1]?.toLowerCase();
      const cfg = getAntiNuke(guildId);

      if (wlSub === "list") {
        if (!cfg.whitelist.length) return message.reply("No users whitelisted.");
        return message.reply(`Whitelisted users:\n${cfg.whitelist.map((id) => `<@${id}>`).join("\n")}`);
      }

      const target = message.mentions.users.first() ?? (args[2] ? { id: args[2] } : null);
      if (!target) return message.reply(usageErr(message, antinukeCommand, "Mention a user or provide their ID"));

      if (wlSub === "add") {
        if (cfg.whitelist.includes(target.id)) return message.reply("❌ Already whitelisted.");
        cfg.whitelist.push(target.id);
        updateAntiNuke(guildId, { whitelist: cfg.whitelist });
        return message.reply(`✅ <@${target.id}> added to the Anti-Nuke whitelist.`);
      }
      if (wlSub === "remove") {
        const idx = cfg.whitelist.indexOf(target.id);
        if (idx === -1) return message.reply("❌ That user is not whitelisted.");
        cfg.whitelist.splice(idx, 1);
        updateAntiNuke(guildId, { whitelist: cfg.whitelist });
        return message.reply(`✅ <@${target.id}> removed from the Anti-Nuke whitelist.`);
      }

      return message.reply(usageErr(message, antinukeCommand, "Invalid whitelist subcommand — use add, remove, or list"));
    }

    // ── status ────────────────────────────────────────────────────────────────
    const cfg = getAntiNuke(guildId);
    const t = cfg.thresholds;
    const embed = new EmbedBuilder()
      .setColor(cfg.enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle("🛡️ Anti-Nuke Configuration")
      .addFields(
        { name: "Status", value: cfg.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Action", value: `\`${cfg.action}\``, inline: true },
        { name: "Window", value: `${cfg.windowMs / 1000}s`, inline: true },
        {
          name: "Thresholds",
          value: [
            `Channel deletes: **${t.channelDelete}**`,
            `Channel creates: **${t.channelCreate ?? 5}**`,
            `Role deletes: **${t.roleDelete}**`,
            `Role creates: **${t.roleCreate ?? 5}**`,
            `Bans: **${t.ban}**`,
            `Kicks: **${t.kick}**`,
            `Webhook creates: **${t.webhookCreate}**`,
          ].join("\n"),
        },
        {
          name: `Whitelist (${cfg.whitelist.length})`,
          value: cfg.whitelist.length ? cfg.whitelist.map((id) => `<@${id}>`).join(", ") : "None",
        },
        {
          name: "Log Channel",
          value: cfg.logChannel ? `<#${cfg.logChannel}>` : "Not set (uses mod log channel)",
        }
      )
      .setFooter({ text: "Use >antinuke enable to activate" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
