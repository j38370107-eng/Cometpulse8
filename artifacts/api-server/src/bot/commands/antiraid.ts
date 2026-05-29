import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { getAntiRaid, updateAntiRaid, AntiRaidAction } from "../store/antiraid";

const VALID_ACTIONS: AntiRaidAction[] = ["ban", "kick", "mute"];

export const antiraidCommand: Command = {
  name: "antiraid",
  aliases: ["ar", "raid"],
  description: "Configure the anti-raid protection system",
  usage: "enable | disable | status | action <ban|kick|mute> | threshold <count> | window <seconds> | lockdown <on|off> | logchannel <#channel | clear>",
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── enable / disable ──────────────────────────────────────────────────────
    if (sub === "enable" || sub === "on") {
      updateAntiRaid(guildId, { enabled: true });
      return message.reply("✅ Anti-Raid protection **enabled**.");
    }
    if (sub === "disable" || sub === "off") {
      updateAntiRaid(guildId, { enabled: false });
      return message.reply("✅ Anti-Raid protection **disabled**.");
    }

    // ── action ────────────────────────────────────────────────────────────────
    if (sub === "action") {
      const act = args[1]?.toLowerCase() as AntiRaidAction;
      if (!VALID_ACTIONS.includes(act)) {
        return message.reply(usageErr(message, antiraidCommand, `Invalid action — choose: ${VALID_ACTIONS.join(", ")}`));
      }
      updateAntiRaid(guildId, { action: act });
      return message.reply(`✅ Anti-Raid action set to **${act}**.`);
    }

    // ── threshold ─────────────────────────────────────────────────────────────
    if (sub === "threshold") {
      const count = parseInt(args[1] ?? "", 10);
      if (isNaN(count) || count < 2 || count > 100) {
        return message.reply("❌ Threshold must be a number between 2 and 100.");
      }
      updateAntiRaid(guildId, { joinThreshold: count });
      return message.reply(`✅ Raid threshold set to **${count} joins**.`);
    }

    // ── window ────────────────────────────────────────────────────────────────
    if (sub === "window") {
      const secs = parseInt(args[1] ?? "", 10);
      if (isNaN(secs) || secs < 1 || secs > 120) {
        return message.reply("❌ Window must be between 1 and 120 seconds.");
      }
      updateAntiRaid(guildId, { joinWindowMs: secs * 1000 });
      return message.reply(`✅ Anti-Raid detection window set to **${secs}s**.`);
    }

    // ── lockdown toggle ───────────────────────────────────────────────────────
    if (sub === "lockdown") {
      const toggle = args[1]?.toLowerCase();
      if (toggle !== "on" && toggle !== "off") {
        return message.reply(usageErr(message, antiraidCommand, "Specify on or off for lockdown"));
      }
      updateAntiRaid(guildId, { lockdown: toggle === "on" });
      return message.reply(
        toggle === "on"
          ? "✅ Auto-lockdown on raid **enabled**. Make sure lockdown channels are set with `>lockdown add #channel`."
          : "✅ Auto-lockdown on raid **disabled**."
      );
    }

    // ── logchannel ────────────────────────────────────────────────────────────
    if (sub === "logchannel") {
      const arg = args[1]?.toLowerCase();
      if (arg === "clear") {
        updateAntiRaid(guildId, { logChannel: undefined });
        return message.reply("✅ Anti-Raid log channel cleared. Events will fall back to the mod log channel.");
      }
      const ch = message.mentions.channels.first() ?? (args[1] ? message.guild.channels.cache.get(args[1]) : null);
      if (!ch || !("send" in ch)) return message.reply(usageErr(message, antiraidCommand, "Mention a valid text channel"));
      updateAntiRaid(guildId, { logChannel: ch.id });
      return message.reply(`✅ Anti-Raid events will be logged to <#${ch.id}>.`);
    }

    // ── status ────────────────────────────────────────────────────────────────
    const cfg = getAntiRaid(guildId);
    const embed = new EmbedBuilder()
      .setColor(cfg.enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle("🛡️ Anti-Raid Configuration")
      .addFields(
        { name: "Status", value: cfg.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Action", value: `\`${cfg.action}\``, inline: true },
        { name: "Auto-Lockdown", value: cfg.lockdown ? "✅ On" : "❌ Off", inline: true },
        { name: "Join Threshold", value: `**${cfg.joinThreshold}** joins`, inline: true },
        { name: "Window", value: `**${cfg.joinWindowMs / 1000}s**`, inline: true },
        { name: "Log Channel", value: cfg.logChannel ? `<#${cfg.logChannel}>` : "Not set (uses mod log channel)", inline: false },
      )
      .setFooter({ text: "Use >antiraid enable to activate" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
