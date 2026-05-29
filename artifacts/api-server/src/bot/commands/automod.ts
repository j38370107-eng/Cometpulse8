import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  getAutomodConfig,
  setModuleEnabled,
  addFilterWord,
  removeFilterWord,
  setMentionThreshold,
  setSpamConfig,
  setDuplicateCount,
  setCharFloodConfig,
  setLinkSpamConfig,
  setWallTextConfig,
  setUrlFilterMode,
  addUrlDomain,
  removeUrlDomain,
  addChannelModuleExempt,
  removeChannelModuleExempt,
  getChannelModuleExempts,
  addExemptRole,
  removeExemptRole,
  addExemptChannel,
  removeExemptChannel,
  setPunishmentStep,
  removePunishmentStep,
  resetPunishmentSteps,
  setSilentMode,
  getStrikes,
  clearStrikes,
  type AutomodAction,
  type EnableableModule,
} from "../store/automod";

const VALID_ACTIONS: AutomodAction[] = ["warn", "mute", "kick", "ban"];
const DURATION_RE = /^(\d+)(s|m|h|d)$/i;

function toggle(args: string[]): boolean | null {
  const val = args[0]?.toLowerCase();
  if (val === "enable" || val === "on")  return true;
  if (val === "disable" || val === "off") return false;
  return null;
}

function sl(enabled: boolean): string {
  return enabled ? "🟢 Enabled" : "🔴 Disabled";
}

export const automodCommand: Command = {
  name: "automod",
  aliases: ["am"],
  description: "Configure AutoMod modules and punishment escalation",
  usage: "<module|status|punishment|strikes|exempt> [subcommand] [options]",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── status ────────────────────────────────────────────────────────────────
    if (!sub || sub === "status") {
      const cfg = getAutomodConfig(guildId);

      const modules = [
        `**Word Filter** — ${sl(cfg.filter.enabled)} (${cfg.filter.words.length} word${cfg.filter.words.length === 1 ? "" : "s"})`,
        `**Anti-Invite** — ${sl(cfg.invite.enabled)}`,
        `**Anti-Mention** — ${sl(cfg.mention.enabled)} (threshold: ${cfg.mention.threshold})`,
        `**Anti-Spam** — ${sl(cfg.spam.enabled)} (${cfg.spam.limit} msg / ${cfg.spam.windowMs / 1000}s)`,
        `**Anti-Duplicate** — ${sl(cfg.duplicate.enabled)} (${cfg.duplicate.count}× same message)`,
        `**Char/Emoji Flood** — ${sl(cfg.charFlood.enabled)} (chars: ${cfg.charFlood.maxRepeat}, emoji: ${cfg.charFlood.maxEmoji})`,
        `**Link Spam** — ${sl(cfg.linkSpam.enabled)} (${cfg.linkSpam.limit} links / ${cfg.linkSpam.windowMs / 1000}s)`,
        `**URL Filter** — ${sl(cfg.urlFilter.enabled)} (${cfg.urlFilter.mode}, ${cfg.urlFilter.domains.length} domain${cfg.urlFilter.domains.length === 1 ? "" : "s"})`,
        `**Wall Text** — ${sl(cfg.wallText.enabled)} (${cfg.wallText.maxLength} chars, ${cfg.wallText.maxLines} lines max)`,
      ];

      const steps = cfg.punishment.steps
        .map((s) => `${s.strikes} strikes → **${s.action}**${s.duration ? ` (${s.duration})` : ""}`)
        .join("\n");

      const exemptRoleList = cfg.exemptRoles.length
        ? cfg.exemptRoles.map((r) => `<@&${r}>`).join(", ")
        : "None";
      const exemptChannelList = cfg.exemptChannels.length
        ? cfg.exemptChannels.map((c) => `<#${c}>`).join(", ")
        : "None";

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("AutoMod Status")
        .addFields(
          { name: "Modules", value: modules.join("\n") },
          { name: "Punishment Escalation", value: steps || "None configured" },
          { name: "Exempt Roles", value: exemptRoleList, inline: true },
          { name: "Exempt Channels", value: exemptChannelList, inline: true },
          { name: "Silent Mode", value: cfg.silent ? "🔇 On — no server notices, DM only" : "🔔 Off — warning posted in channel", inline: false },
        );
      return message.reply({ embeds: [embed] });
    }

    // ── filter ────────────────────────────────────────────────────────────────
    if (sub === "filter") {
      const action = args[1]?.toLowerCase();
      if (action === "enable" || action === "on" || action === "disable" || action === "off") {
        const enabled = action === "enable" || action === "on";
        setModuleEnabled(guildId, "filter", enabled);
        return message.reply(`✅ Word filter **${enabled ? "enabled" : "disabled"}**.`);
      }
      if (action === "add") {
        const word = args[2];
        if (!word) return message.reply(usageErr(message, automodCommand, "Provide a word to add"));
        addFilterWord(guildId, word);
        return message.reply(`✅ Added \`${word.toLowerCase()}\` to the filter.`);
      }
      if (action === "remove" || action === "del") {
        const word = args[2];
        if (!word) return message.reply(usageErr(message, automodCommand, "Provide a word to remove"));
        const ok = removeFilterWord(guildId, word);
        return message.reply(ok ? `✅ Removed \`${word.toLowerCase()}\` from the filter.` : `❌ That word isn't in the filter.`);
      }
      if (action === "list") {
        const words = getAutomodConfig(guildId).filter.words;
        return message.reply(words.length ? `**Filtered words (${words.length}):**\n${words.map((w) => `\`${w}\``).join(", ")}` : "No words in the filter yet.");
      }
      return message.reply(usageErr(message, automodCommand, "Invalid filter subcommand — use enable, disable, add <word>, remove <word>, or list"));
    }

    // ── invite ────────────────────────────────────────────────────────────────
    if (sub === "invite") {
      const enabled = toggle(args.slice(1));
      if (enabled === null) return message.reply(usageErr(message, automodCommand, "Specify enable or disable for invite"));
      setModuleEnabled(guildId, "invite", enabled);
      return message.reply(`✅ Anti-invite **${enabled ? "enabled" : "disabled"}**.`);
    }

    // ── mention ───────────────────────────────────────────────────────────────
    if (sub === "mention") {
      const action = args[1]?.toLowerCase();
      if (action === "enable" || action === "on")   { setModuleEnabled(guildId, "mention", true);  return message.reply("✅ Anti-mention **enabled**."); }
      if (action === "disable" || action === "off") { setModuleEnabled(guildId, "mention", false); return message.reply("✅ Anti-mention **disabled**."); }
      if (action === "threshold") {
        const n = parseInt(args[2] ?? "", 10);
        if (isNaN(n) || n < 1) return message.reply(usageErr(message, automodCommand, "Provide a valid threshold number (e.g. 5)"));
        setMentionThreshold(guildId, n);
        return message.reply(`✅ Mention threshold set to **${n}**.`);
      }
      return message.reply(usageErr(message, automodCommand, "Invalid mention subcommand — use enable, disable, or threshold <n>"));
    }

    // ── spam ──────────────────────────────────────────────────────────────────
    if (sub === "spam") {
      const action = args[1]?.toLowerCase();
      if (action === "enable" || action === "on")   { setModuleEnabled(guildId, "spam", true);  return message.reply("✅ Anti-spam **enabled**."); }
      if (action === "disable" || action === "off") { setModuleEnabled(guildId, "spam", false); return message.reply("✅ Anti-spam **disabled**."); }
      if (action === "set") {
        const limit     = parseInt(args[2] ?? "", 10);
        const windowSec = parseInt(args[3] ?? "", 10);
        if (isNaN(limit) || isNaN(windowSec) || limit < 2 || windowSec < 1) {
          return message.reply(usageErr(message, automodCommand, "Provide valid numbers — e.g. spam set 5 5"));
        }
        setSpamConfig(guildId, limit, windowSec * 1000);
        return message.reply(`✅ Anti-spam: **${limit}** messages per **${windowSec}s**.`);
      }
      return message.reply(usageErr(message, automodCommand, "Invalid spam subcommand — use enable, disable, or set <messages> <seconds>"));
    }

    // ── duplicate ─────────────────────────────────────────────────────────────
    if (sub === "duplicate" || sub === "dup") {
      const action = args[1]?.toLowerCase();
      if (action === "enable" || action === "on")   { setModuleEnabled(guildId, "duplicate", true);  return message.reply("✅ Anti-duplicate **enabled**."); }
      if (action === "disable" || action === "off") { setModuleEnabled(guildId, "duplicate", false); return message.reply("✅ Anti-duplicate **disabled**."); }
      if (action === "set") {
        const n = parseInt(args[2] ?? "", 10);
        if (isNaN(n) || n < 2) return message.reply(usageErr(message, automodCommand, "Provide a count ≥ 2 (e.g. duplicate set 3)"));
        setDuplicateCount(guildId, n);
        return message.reply(`✅ Anti-duplicate: triggers after **${n}** identical messages.`);
      }
      return message.reply(usageErr(message, automodCommand, "Invalid duplicate subcommand — use enable, disable, or set <count>"));
    }

    // ── charflood ─────────────────────────────────────────────────────────────
    if (sub === "charflood" || sub === "flood" || sub === "cf") {
      const action = args[1]?.toLowerCase();
      if (action === "enable" || action === "on")   { setModuleEnabled(guildId, "charFlood", true);  return message.reply("✅ Char/emoji flood **enabled**."); }
      if (action === "disable" || action === "off") { setModuleEnabled(guildId, "charFlood", false); return message.reply("✅ Char/emoji flood **disabled**."); }
      if (action === "set") {
        const field = args[2]?.toLowerCase();
        const n     = parseInt(args[3] ?? "", 10);
        const cfg   = getAutomodConfig(guildId);
        if (field === "chars" || field === "repeat") {
          if (isNaN(n) || n < 2) return message.reply(usageErr(message, automodCommand, "Provide a char repeat count ≥ 2"));
          setCharFloodConfig(guildId, n, cfg.charFlood.maxEmoji);
          return message.reply(`✅ Char flood: triggers at **${n}** consecutive identical characters.`);
        }
        if (field === "emoji") {
          if (isNaN(n) || n < 1) return message.reply(usageErr(message, automodCommand, "Provide an emoji count ≥ 1"));
          setCharFloodConfig(guildId, cfg.charFlood.maxRepeat, n);
          return message.reply(`✅ Emoji flood: triggers at **${n}** emoji per message.`);
        }
        return message.reply(usageErr(message, automodCommand, "Specify chars or emoji — e.g. charflood set chars 10"));
      }
      return message.reply(usageErr(message, automodCommand, "Invalid charflood subcommand — use enable, disable, or set chars/emoji <n>"));
    }

    // ── linkspam ──────────────────────────────────────────────────────────────
    if (sub === "linkspam" || sub === "links") {
      const action = args[1]?.toLowerCase();
      if (action === "enable" || action === "on")   { setModuleEnabled(guildId, "linkSpam", true);  return message.reply("✅ Link spam **enabled**."); }
      if (action === "disable" || action === "off") { setModuleEnabled(guildId, "linkSpam", false); return message.reply("✅ Link spam **disabled**."); }
      if (action === "set") {
        const limit     = parseInt(args[2] ?? "", 10);
        const windowSec = parseInt(args[3] ?? "", 10);
        if (isNaN(limit) || isNaN(windowSec) || limit < 1 || windowSec < 1) {
          return message.reply(usageErr(message, automodCommand, "Provide valid numbers — e.g. linkspam set 5 10"));
        }
        setLinkSpamConfig(guildId, limit, windowSec * 1000);
        return message.reply(`✅ Link spam: **${limit}** links/attachments per **${windowSec}s**.`);
      }
      return message.reply(usageErr(message, automodCommand, "Invalid linkspam subcommand — use enable, disable, or set <count> <seconds>"));
    }

    // ── urlfilter ─────────────────────────────────────────────────────────────
    if (sub === "urlfilter" || sub === "url" || sub === "domain") {
      const action = args[1]?.toLowerCase();
      if (action === "enable" || action === "on")   { setModuleEnabled(guildId, "urlFilter", true);  return message.reply("✅ URL filter **enabled**."); }
      if (action === "disable" || action === "off") { setModuleEnabled(guildId, "urlFilter", false); return message.reply("✅ URL filter **disabled**."); }
      if (action === "mode") {
        const mode = args[2]?.toLowerCase();
        if (mode !== "whitelist" && mode !== "blacklist") {
          return message.reply(usageErr(message, automodCommand, "Specify whitelist or blacklist for urlfilter mode"));
        }
        setUrlFilterMode(guildId, mode);
        return message.reply(`✅ URL filter mode set to **${mode}**.\n${mode === "whitelist" ? "Only listed domains will be allowed." : "Listed domains will be blocked."}`);
      }
      if (action === "add") {
        const domain = args[2]?.toLowerCase().replace(/^(?:https?:\/\/)?(?:www\.)?/, "").split("/")[0];
        if (!domain) return message.reply(usageErr(message, automodCommand, "Provide a domain (e.g. example.com)"));
        const ok = addUrlDomain(guildId, domain);
        return message.reply(ok ? `✅ Added \`${domain}\` to the URL filter.` : `❌ \`${domain}\` is already in the list.`);
      }
      if (action === "remove" || action === "del") {
        const domain = args[2]?.toLowerCase().replace(/^(?:https?:\/\/)?(?:www\.)?/, "").split("/")[0];
        if (!domain) return message.reply(usageErr(message, automodCommand, "Provide a domain to remove"));
        const ok = removeUrlDomain(guildId, domain);
        return message.reply(ok ? `✅ Removed \`${domain}\` from the URL filter.` : `❌ \`${domain}\` is not in the list.`);
      }
      if (action === "list") {
        const cfg = getAutomodConfig(guildId);
        const list = cfg.urlFilter.domains;
        const modeLabel = cfg.urlFilter.mode === "whitelist" ? "✅ Whitelist" : "🚫 Blacklist";
        return message.reply(
          list.length
            ? `**URL Filter — ${modeLabel} (${list.length} domain${list.length === 1 ? "" : "s"}):**\n${list.map((d) => `\`${d}\``).join(", ")}`
            : `URL filter list is empty (mode: **${cfg.urlFilter.mode}**).`
        );
      }
      return message.reply(usageErr(message, automodCommand, "Invalid urlfilter subcommand — use enable, disable, mode, add <domain>, remove <domain>, or list"));
    }

    // ── walltext ──────────────────────────────────────────────────────────────
    if (sub === "walltext" || sub === "wall" || sub === "wt") {
      const action = args[1]?.toLowerCase();
      if (action === "enable" || action === "on")   { setModuleEnabled(guildId, "wallText", true);  return message.reply("✅ Wall text detection **enabled**."); }
      if (action === "disable" || action === "off") { setModuleEnabled(guildId, "wallText", false); return message.reply("✅ Wall text detection **disabled**."); }
      if (action === "set") {
        const field = args[2]?.toLowerCase();
        const n     = parseInt(args[3] ?? "", 10);
        const cfg   = getAutomodConfig(guildId);
        if (field === "length" || field === "chars") {
          if (isNaN(n) || n < 100) return message.reply(usageErr(message, automodCommand, "Provide a character limit ≥ 100"));
          setWallTextConfig(guildId, n, cfg.wallText.maxLines);
          return message.reply(`✅ Wall text: deletes messages longer than **${n} characters**.`);
        }
        if (field === "lines") {
          if (isNaN(n) || n < 2) return message.reply(usageErr(message, automodCommand, "Provide a line limit ≥ 2"));
          setWallTextConfig(guildId, cfg.wallText.maxLength, n);
          return message.reply(`✅ Wall text: deletes messages with more than **${n} lines**.`);
        }
        return message.reply(usageErr(message, automodCommand, "Specify length or lines — e.g. walltext set length 500"));
      }
      const cfg = getAutomodConfig(guildId);
      return message.reply(
        `**Wall Text** — ${sl(cfg.wallText.enabled)}\nMax characters: **${cfg.wallText.maxLength}** • Max lines: **${cfg.wallText.maxLines}**\n\n` +
        `\`>automod walltext enable|disable|set length <n>|set lines <n>\``
      );
    }

    // ── channel — per-channel module overrides ────────────────────────────────
    if (sub === "channel") {
      const MODULE_ALIASES: Record<string, EnableableModule> = {
        filter: "filter", words: "filter", word: "filter", wordfilter: "filter",
        invite: "invite", invites: "invite", antiinvite: "invite",
        mention: "mention", mentions: "mention", antimention: "mention",
        spam: "spam", antispam: "spam",
        duplicate: "duplicate", dup: "duplicate", antiduplicate: "duplicate",
        charflood: "charFlood", flood: "charFlood", emoji: "charFlood", cf: "charFlood",
        linkspam: "linkSpam", link: "linkSpam", links: "linkSpam",
        urlfilter: "urlFilter", url: "urlFilter", domain: "urlFilter",
        walltext: "wallText", wall: "wallText", wt: "wallText",
      };

      const ALL_MODULES: EnableableModule[] = [
        "filter", "invite", "mention", "spam", "duplicate",
        "charFlood", "linkSpam", "urlFilter", "wallText",
      ];

      const MODULE_LABELS: Record<EnableableModule, string> = {
        filter:    "Word Filter",
        invite:    "Anti-Invite",
        mention:   "Anti-Mention",
        spam:      "Anti-Spam",
        duplicate: "Anti-Duplicate",
        charFlood: "Char/Emoji Flood",
        linkSpam:  "Link Spam",
        urlFilter: "URL Filter",
        wallText:  "Wall Text",
      };

      // >automod channel list  — show all per-channel overrides across the server
      if (args[1]?.toLowerCase() === "list") {
        const exempts = getChannelModuleExempts(guildId);
        const entries = Object.entries(exempts).filter(([, mods]) => mods.length > 0);
        if (entries.length === 0) return message.reply("No per-channel module overrides are set.");
        const lines = entries.map(([cid, mods]) =>
          `<#${cid}> — ${mods.map((m) => `\`${MODULE_LABELS[m] ?? m}\``).join(", ")} disabled`
        ).join("\n");
        return message.reply({ embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("Per-Channel AutoMod Overrides")
            .setDescription(lines),
        ]});
      }

      const mentionedChannel = message.mentions.channels.first();
      const targetChannelId  = mentionedChannel?.id ?? (args[1]?.match(/^\d+$/) ? args[1] : undefined);

      // No channel provided — show usage
      if (!targetChannelId) {
        return message.reply(
          "**Per-channel AutoMod control**\n" +
          "`>automod channel #channel` — show module status for a channel\n" +
          "`>automod channel #channel <module> off` — disable a module in that channel\n" +
          "`>automod channel #channel <module> on` — re-enable a module in that channel\n" +
          "`>automod channel list` — show all channels with overrides\n\n" +
          "**Modules:** `filter`, `invite`, `mention`, `spam`, `duplicate`, `charflood`, `linkspam`, `urlfilter`, `walltext`"
        );
      }

      const moduleRaw = args[2]?.toLowerCase();
      const onOff     = args[3]?.toLowerCase();

      // >automod channel #channel  — show status for this specific channel
      if (!moduleRaw) {
        const cfg     = getAutomodConfig(guildId);
        const exempts = getChannelModuleExempts(guildId);
        const skipped = new Set(exempts[targetChannelId] ?? []);
        const lines   = ALL_MODULES.map((m) => {
          const globalOn    = (cfg[m] as { enabled: boolean }).enabled;
          const channelOff  = skipped.has(m);
          const icon = !globalOn ? "⚫" : channelOff ? "🔴" : "🟢";
          const note = !globalOn ? "(disabled globally)" : channelOff ? "(off in this channel)" : "";
          return `${icon} **${MODULE_LABELS[m]}** ${note}`.trimEnd();
        });
        return message.reply({ embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`AutoMod — <#${targetChannelId}>`)
            .setDescription(lines.join("\n"))
            .setFooter({ text: "🟢 active  🔴 off in this channel  ⚫ disabled globally" }),
        ]});
      }

      // >automod channel #channel <module> on|off
      const resolvedModule = MODULE_ALIASES[moduleRaw];
      if (!resolvedModule) {
        return message.reply(usageErr(message, automodCommand, `Unknown module "${moduleRaw}" — valid: filter, invite, mention, spam, duplicate, charflood, linkspam, urlfilter, walltext`));
      }

      if (!onOff || (onOff !== "on" && onOff !== "off")) {
        return message.reply(usageErr(message, automodCommand, `Specify on or off — e.g. channel #channel ${moduleRaw} off`));
      }

      if (onOff === "off") {
        const ok = addChannelModuleExempt(guildId, targetChannelId, resolvedModule);
        return message.reply(ok
          ? `✅ **${MODULE_LABELS[resolvedModule]}** is now **off** in <#${targetChannelId}>. All other channels are unaffected.`
          : `ℹ️ **${MODULE_LABELS[resolvedModule]}** is already off in <#${targetChannelId}>.`
        );
      } else {
        const ok = removeChannelModuleExempt(guildId, targetChannelId, resolvedModule);
        return message.reply(ok
          ? `✅ **${MODULE_LABELS[resolvedModule]}** is now **on** again in <#${targetChannelId}>.`
          : `ℹ️ **${MODULE_LABELS[resolvedModule]}** was already on in <#${targetChannelId}>.`
        );
      }
    }

    // ── channelskip (legacy alias kept for backwards compatibility) ───────────
    if (sub === "channelskip" || sub === "cskip" || sub === "cs") {
      const MODULE_ALIASES: Record<string, EnableableModule> = {
        filter: "filter", words: "filter", word: "filter",
        invite: "invite",
        mention: "mention", mentions: "mention",
        spam: "spam", antispam: "spam",
        duplicate: "duplicate", dup: "duplicate",
        charflood: "charFlood", flood: "charFlood", emoji: "charFlood",
        linkspam: "linkSpam", link: "linkSpam", links: "linkSpam",
        urlfilter: "urlFilter", url: "urlFilter", domain: "urlFilter",
        walltext: "wallText", wall: "wallText", wt: "wallText",
      };

      const action = args[1]?.toLowerCase();

      if (action === "list") {
        const exempts = getChannelModuleExempts(guildId);
        const entries = Object.entries(exempts);
        if (entries.length === 0) return message.reply("No per-channel module exemptions set.");
        const lines = entries.map(([cid, mods]) => `<#${cid}> — \`${mods.join("`, `")}\``).join("\n");
        return message.reply(`**Per-channel module exemptions:**\n${lines}`);
      }

      const mentionedChannel = message.mentions.channels.first();
      const targetChannelId  = mentionedChannel?.id ?? args[2];
      const moduleRaw        = (args[3] ?? args[2])?.toLowerCase();
      const resolvedModule   = moduleRaw ? MODULE_ALIASES[moduleRaw] : undefined;

      if (!targetChannelId) return message.reply(usageErr(message, automodCommand, "Mention a channel — e.g. channelskip add #channel <module>"));

      if (action === "add" || action === "skip") {
        if (!resolvedModule) return message.reply(usageErr(message, automodCommand, "Unknown module — valid: filter, invite, mention, spam, duplicate, charFlood, linkSpam, urlFilter, wallText"));
        const ok = addChannelModuleExempt(guildId, targetChannelId, resolvedModule);
        return message.reply(ok
          ? `✅ <#${targetChannelId}> will now skip the **${resolvedModule}** module.`
          : `❌ That module is already skipped in <#${targetChannelId}>.`
        );
      }

      if (action === "remove" || action === "del") {
        if (!resolvedModule) return message.reply(usageErr(message, automodCommand, "Unknown module — valid: filter, invite, mention, spam, duplicate, charFlood, linkSpam, urlFilter, wallText"));
        const ok = removeChannelModuleExempt(guildId, targetChannelId, resolvedModule);
        return message.reply(ok
          ? `✅ Removed **${resolvedModule}** exemption from <#${targetChannelId}>.`
          : `❌ That module wasn't skipped in <#${targetChannelId}>.`
        );
      }

      // show exemptions for a specific channel
      const exempts = getChannelModuleExempts(guildId);
      const mods = exempts[targetChannelId];
      return message.reply(mods?.length
        ? `**Skipped modules in <#${targetChannelId}>:** \`${mods.join("`, `")}\``
        : `No module-specific exemptions set for <#${targetChannelId}>.`
      );
    }

    // ── exempt ────────────────────────────────────────────────────────────────
    if (sub === "exempt") {
      const type   = args[1]?.toLowerCase();
      const action = args[2]?.toLowerCase();

      if (type === "role") {
        if (action === "list") {
          const roles = getAutomodConfig(guildId).exemptRoles;
          return message.reply(roles.length ? `**Exempt roles:** ${roles.map((r) => `<@&${r}>`).join(", ")}` : "No exempt roles.");
        }
        const roleId = message.mentions.roles.first()?.id ?? args[3];
        if (!roleId) return message.reply(usageErr(message, automodCommand, "Mention a role or provide a role ID"));
        if (action === "add") {
          const ok = addExemptRole(guildId, roleId);
          return message.reply(ok ? `✅ <@&${roleId}> is now exempt from AutoMod.` : `❌ That role is already exempt.`);
        }
        if (action === "remove" || action === "del") {
          const ok = removeExemptRole(guildId, roleId);
          return message.reply(ok ? `✅ Removed <@&${roleId}> from the exempt list.` : `❌ That role wasn't exempt.`);
        }
        return message.reply(usageErr(message, automodCommand, "Invalid exempt role subcommand — use add, remove, or list"));
      }

      if (type === "channel") {
        if (action === "list") {
          const channels = getAutomodConfig(guildId).exemptChannels;
          return message.reply(channels.length ? `**Exempt channels:** ${channels.map((c) => `<#${c}>`).join(", ")}` : "No exempt channels.");
        }
        const channelId = message.mentions.channels.first()?.id ?? args[3];
        if (!channelId) return message.reply(usageErr(message, automodCommand, "Mention a channel or provide a channel ID"));
        if (action === "add") {
          const ok = addExemptChannel(guildId, channelId);
          return message.reply(ok ? `✅ <#${channelId}> is now exempt from AutoMod.` : `❌ That channel is already exempt.`);
        }
        if (action === "remove" || action === "del") {
          const ok = removeExemptChannel(guildId, channelId);
          return message.reply(ok ? `✅ Removed <#${channelId}> from the exempt list.` : `❌ That channel wasn't exempt.`);
        }
        return message.reply(usageErr(message, automodCommand, "Invalid exempt channel subcommand — use add, remove, or list"));
      }

      return message.reply(usageErr(message, automodCommand, "Specify role or channel for exempt"));
    }

    // ── punishment ────────────────────────────────────────────────────────────
    if (sub === "punishment" || sub === "punish") {
      const action = args[1]?.toLowerCase();

      if (!action || action === "list") {
        const steps = getAutomodConfig(guildId).punishment.steps;
        const lines = steps.map((s) => `**${s.strikes}** strikes → \`${s.action}\`${s.duration ? ` (${s.duration})` : ""}`);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("AutoMod Punishment Escalation").setDescription(lines.length ? lines.join("\n") : "No steps configured.")] });
      }

      if (action === "set") {
        const strikesN      = parseInt(args[2] ?? "", 10);
        const punishAction  = args[3]?.toLowerCase() as AutomodAction;
        if (isNaN(strikesN) || strikesN < 1 || !VALID_ACTIONS.includes(punishAction)) {
          return message.reply(usageErr(message, automodCommand, "Provide a strike count and valid action — e.g. punishment set 3 mute 10m"));
        }
        const duration = args[4];
        if (punishAction === "mute" && (!duration || !DURATION_RE.test(duration))) {
          return message.reply("❌ Mute requires a duration, e.g. `10m`, `1h`.");
        }
        setPunishmentStep(guildId, { strikes: strikesN, action: punishAction, duration });
        return message.reply(`✅ At **${strikesN}** strikes → \`${punishAction}\`${duration ? ` (${duration})` : ""}.`);
      }

      if (action === "remove" || action === "del") {
        const strikesN = parseInt(args[2] ?? "", 10);
        if (isNaN(strikesN)) return message.reply(usageErr(message, automodCommand, "Provide a strike count to remove"));
        const ok = removePunishmentStep(guildId, strikesN);
        return message.reply(ok ? `✅ Removed step at **${strikesN}** strikes.` : `❌ No step at **${strikesN}** strikes.`);
      }

      if (action === "reset") {
        resetPunishmentSteps(guildId);
        return message.reply("✅ Punishment steps reset.");
      }

      return message.reply(usageErr(message, automodCommand, "Invalid punishment subcommand — use list, set <strikes> <action>, remove <strikes>, or reset"));
    }

    // ── silent ────────────────────────────────────────────────────────────────
    if (sub === "silent") {
      const val = args[1]?.toLowerCase();
      if (val === "on" || val === "enable") {
        setSilentMode(guildId, true);
        return message.reply("🔇 Silent mode **enabled** — AutoMod will delete messages and DM users without posting any notice in the server.");
      }
      if (val === "off" || val === "disable") {
        setSilentMode(guildId, false);
        return message.reply("🔔 Silent mode **disabled** — AutoMod warnings will be posted in the server channel.");
      }
      const current = getAutomodConfig(guildId).silent;
      return message.reply(`Silent mode is currently **${current ? "on 🔇" : "off 🔔"}**.\nUsage: \`>automod silent on|off\``);
    }

    // ── strikes ───────────────────────────────────────────────────────────────
    if (sub === "strikes") {
      const action = args[1]?.toLowerCase();
      if (action === "clear") {
        const mention = message.mentions.users.first();
        const userId  = mention?.id ?? args[2];
        if (!userId) return message.reply(usageErr(message, automodCommand, "Mention a user or provide their ID to clear strikes"));
        clearStrikes(guildId, userId);
        return message.reply(`✅ Cleared AutoMod strikes for <@${userId}>.`);
      }
      const mention = message.mentions.users.first();
      const userId  = mention?.id ?? args[1];
      if (!userId) return message.reply(usageErr(message, automodCommand, "Mention a user or provide their ID"));
      const count = getStrikes(guildId, userId);
      return message.reply(`<@${userId}> has **${count}** AutoMod strike${count === 1 ? "" : "s"}.`);
    }

    return message.reply(usageErr(message, automodCommand, "Invalid subcommand — use status, filter, invite, mention, spam, duplicate, charflood, linkspam, urlfilter, walltext, channel, exempt, punishment, strikes, or silent"));
  },
};
