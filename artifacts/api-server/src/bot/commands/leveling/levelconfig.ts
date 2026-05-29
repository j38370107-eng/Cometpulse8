import type { Command } from "../types";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import {
  getLevelConfig,
  setLevelConfig,
  DEFAULT_CONFIG,
  type LevelConfig,
} from "../../store/levels";

function usage(): string {
  return [
    "**Subcommands:**",
    "`levelconfig view` — Show current settings",
    "`levelconfig toggle` — Enable / disable leveling",
    "`levelconfig channel #channel | here | off` — Set level-up announcement channel",
    "`levelconfig xprate <0.1–10>` — Set base XP multiplier",
    "`levelconfig rolereward add <level> @role` — Add role reward at a level",
    "`levelconfig rolereward remove <level>` — Remove a role reward",
    "`levelconfig rolemultiplier add @role <mult>` — Role XP multiplier",
    "`levelconfig rolemultiplier remove @role` — Remove role multiplier",
    "`levelconfig channelmultiplier add #chan <mult>` — Channel XP multiplier",
    "`levelconfig channelmultiplier remove #chan` — Remove channel multiplier",
    "`levelconfig booster <mult>` — XP multiplier for server boosters",
    "`levelconfig doublexp on|off [hours]` — Toggle double XP event",
    "`levelconfig noxpchannel add|remove #chan` — No-XP channels",
    "`levelconfig noxprole add|remove @role` — No-XP roles",
    "`levelconfig dm on|off` — DM users on level-up",
    "`levelconfig message <text|off>` — Custom level-up message ({user}, {level})",
    "`levelconfig rolestack on|off` — Stack role rewards vs replace",
    "`levelconfig reset` — Reset to defaults",
  ].join("\n");
}

function viewEmbed(guildId: string, cfg: LevelConfig): EmbedBuilder {
  const doubleXpStatus = cfg.doubleXpActive
    ? cfg.doubleXpEnd
      ? `On (ends <t:${Math.floor(cfg.doubleXpEnd / 1000)}:R>)`
      : "On (no end)"
    : "Off";

  const rewardLines =
    cfg.roleRewards.length > 0
      ? cfg.roleRewards
          .sort((a, b) => a.level - b.level)
          .map((r) => `Level ${r.level} → <@&${r.roleId}>`)
          .join("\n")
      : "None";

  const roleMults =
    cfg.multiplierRoles.length > 0
      ? cfg.multiplierRoles.map((r) => `<@&${r.roleId}> ×${r.multiplier}`).join("\n")
      : "None";

  const chanMults =
    cfg.multiplierChannels.length > 0
      ? cfg.multiplierChannels.map((c) => `<#${c.channelId}> ×${c.multiplier}`).join("\n")
      : "None";

  return new EmbedBuilder()
    .setTitle("⚡ Leveling Configuration")
    .setColor(0x7c3cfa)
    .addFields(
      { name: "Status", value: cfg.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
      { name: "XP Rate", value: `×${cfg.xpRate}`, inline: true },
      { name: "Booster Multiplier", value: `×${cfg.boosterMultiplier}`, inline: true },
      { name: "Double XP", value: doubleXpStatus, inline: true },
      { name: "DM on Level-Up", value: cfg.dmOnLevelUp ? "Yes" : "No", inline: true },
      { name: "Role Stacking", value: cfg.roleStack ? "Stack" : "Replace", inline: true },
      { name: "Announce Channel", value: cfg.channelId ? `<#${cfg.channelId}>` : "Same channel", inline: true },
      { name: "Custom Message", value: cfg.levelUpMessage ?? "Default", inline: false },
      { name: "Role Rewards", value: rewardLines, inline: false },
      { name: "Role Multipliers", value: roleMults, inline: true },
      { name: "Channel Multipliers", value: chanMults, inline: true },
      {
        name: "No-XP Channels",
        value: cfg.noXpChannels.length > 0 ? cfg.noXpChannels.map((c) => `<#${c}>`).join(", ") : "None",
        inline: true,
      },
      {
        name: "No-XP Roles",
        value: cfg.noXpRoles.length > 0 ? cfg.noXpRoles.map((r) => `<@&${r}>`).join(", ") : "None",
        inline: true,
      },
    );
}

export const levelConfigCommand: Command = {
  name: "levelconfig",
  aliases: ["lc", "lvlconfig", "levelsetup"],
  description: "Configure the leveling system.",
  usage: "<subcommand> [args]",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;

    const guildId = message.guild.id;
    const cfg = getLevelConfig(guildId);
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === "help") {
      return message.reply(usage());
    }

    if (sub === "view") {
      return message.channel.send({ embeds: [viewEmbed(guildId, cfg)] });
    }

    if (sub === "toggle") {
      cfg.enabled = !cfg.enabled;
      setLevelConfig(guildId, cfg);
      return message.reply(`✅ Leveling is now **${cfg.enabled ? "enabled" : "disabled"}**.`);
    }

    if (sub === "channel") {
      const val = args[1]?.toLowerCase();
      if (val === "off") {
        cfg.channelId = null;
        setLevelConfig(guildId, cfg);
        return message.reply("✅ Level-up announcements will be sent in the message's channel.");
      }
      if (val === "here") {
        cfg.channelId = message.channelId;
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ Level-up announcements set to <#${message.channelId}>.`);
      }
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply("❌ Usage: `levelconfig channel #channel | here | off`");
      cfg.channelId = ch.id;
      setLevelConfig(guildId, cfg);
      return message.reply(`✅ Level-up announcements set to <#${ch.id}>.`);
    }

    if (sub === "xprate") {
      const rate = parseFloat(args[1] ?? "");
      if (isNaN(rate) || rate < 0.1 || rate > 10) {
        return message.reply("❌ XP rate must be between 0.1 and 10.");
      }
      cfg.xpRate = rate;
      setLevelConfig(guildId, cfg);
      return message.reply(`✅ Base XP rate set to **×${rate}**.`);
    }

    if (sub === "rolereward") {
      const action = args[1]?.toLowerCase();
      if (action === "add") {
        const level = parseInt(args[2] ?? "");
        const role = message.mentions.roles.first();
        if (isNaN(level) || level < 1 || !role) {
          return message.reply("❌ Usage: `levelconfig rolereward add <level> @role`");
        }
        cfg.roleRewards = cfg.roleRewards.filter((r) => r.level !== level);
        cfg.roleRewards.push({ level, roleId: role.id });
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ <@&${role.id}> will be assigned at Level **${level}**.`);
      }
      if (action === "remove") {
        const level = parseInt(args[2] ?? "");
        if (isNaN(level)) return message.reply("❌ Usage: `levelconfig rolereward remove <level>`");
        const before = cfg.roleRewards.length;
        cfg.roleRewards = cfg.roleRewards.filter((r) => r.level !== level);
        setLevelConfig(guildId, cfg);
        return message.reply(
          before !== cfg.roleRewards.length
            ? `✅ Removed role reward for Level **${level}**.`
            : `❌ No role reward found for Level **${level}**.`,
        );
      }
      return message.reply("❌ Usage: `levelconfig rolereward add|remove <level> [@role]`");
    }

    if (sub === "rolemultiplier") {
      const action = args[1]?.toLowerCase();
      const role = message.mentions.roles.first();
      if (action === "add") {
        const mult = parseFloat(args[2] ?? "");
        if (!role || isNaN(mult) || mult <= 0) {
          return message.reply("❌ Usage: `levelconfig rolemultiplier add @role <multiplier>`");
        }
        cfg.multiplierRoles = cfg.multiplierRoles.filter((r) => r.roleId !== role.id);
        cfg.multiplierRoles.push({ roleId: role.id, multiplier: mult });
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ <@&${role.id}> now gives **×${mult}** XP.`);
      }
      if (action === "remove") {
        if (!role) return message.reply("❌ Usage: `levelconfig rolemultiplier remove @role`");
        cfg.multiplierRoles = cfg.multiplierRoles.filter((r) => r.roleId !== role.id);
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ Removed XP multiplier for <@&${role.id}>.`);
      }
      return message.reply("❌ Usage: `levelconfig rolemultiplier add|remove @role [multiplier]`");
    }

    if (sub === "channelmultiplier") {
      const action = args[1]?.toLowerCase();
      const ch = message.mentions.channels.first();
      if (action === "add") {
        const mult = parseFloat(args[2] ?? "");
        if (!ch || isNaN(mult) || mult <= 0) {
          return message.reply("❌ Usage: `levelconfig channelmultiplier add #channel <multiplier>`");
        }
        cfg.multiplierChannels = cfg.multiplierChannels.filter((c) => c.channelId !== ch.id);
        cfg.multiplierChannels.push({ channelId: ch.id, multiplier: mult });
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ <#${ch.id}> now gives **×${mult}** XP.`);
      }
      if (action === "remove") {
        if (!ch) return message.reply("❌ Usage: `levelconfig channelmultiplier remove #channel`");
        cfg.multiplierChannels = cfg.multiplierChannels.filter((c) => c.channelId !== ch.id);
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ Removed XP multiplier for <#${ch.id}>.`);
      }
      return message.reply("❌ Usage: `levelconfig channelmultiplier add|remove #channel [multiplier]`");
    }

    if (sub === "booster") {
      const mult = parseFloat(args[1] ?? "");
      if (isNaN(mult) || mult < 1) {
        return message.reply("❌ Booster multiplier must be ≥ 1. Example: `levelconfig booster 1.5`");
      }
      cfg.boosterMultiplier = mult;
      setLevelConfig(guildId, cfg);
      return message.reply(`✅ Server boosters now earn **×${mult}** XP.`);
    }

    if (sub === "doublexp") {
      const val = args[1]?.toLowerCase();
      if (val === "off") {
        cfg.doubleXpActive = false;
        cfg.doubleXpEnd = null;
        setLevelConfig(guildId, cfg);
        return message.reply("✅ Double XP event **ended**.");
      }
      if (val === "on") {
        const hours = parseFloat(args[2] ?? "0");
        cfg.doubleXpActive = true;
        cfg.doubleXpEnd = hours > 0 ? Date.now() + hours * 60 * 60 * 1000 : null;
        setLevelConfig(guildId, cfg);
        const msg = hours > 0 ? `for **${hours}h**` : "with no end time";
        return message.reply(`🎉 Double XP event started ${msg}!`);
      }
      return message.reply("❌ Usage: `levelconfig doublexp on [hours] | off`");
    }

    if (sub === "noxpchannel") {
      const action = args[1]?.toLowerCase();
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply("❌ Please mention a channel.");
      if (action === "add") {
        if (!cfg.noXpChannels.includes(ch.id)) cfg.noXpChannels.push(ch.id);
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ <#${ch.id}> is now a no-XP zone.`);
      }
      if (action === "remove") {
        cfg.noXpChannels = cfg.noXpChannels.filter((c) => c !== ch.id);
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ <#${ch.id}> removed from no-XP channels.`);
      }
      return message.reply("❌ Usage: `levelconfig noxpchannel add|remove #channel`");
    }

    if (sub === "noxprole") {
      const action = args[1]?.toLowerCase();
      const role = message.mentions.roles.first();
      if (!role) return message.reply("❌ Please mention a role.");
      if (action === "add") {
        if (!cfg.noXpRoles.includes(role.id)) cfg.noXpRoles.push(role.id);
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ <@&${role.id}> is now a no-XP role.`);
      }
      if (action === "remove") {
        cfg.noXpRoles = cfg.noXpRoles.filter((r) => r !== role.id);
        setLevelConfig(guildId, cfg);
        return message.reply(`✅ <@&${role.id}> removed from no-XP roles.`);
      }
      return message.reply("❌ Usage: `levelconfig noxprole add|remove @role`");
    }

    if (sub === "dm") {
      const val = args[1]?.toLowerCase();
      if (val === "on") {
        cfg.dmOnLevelUp = true;
        setLevelConfig(guildId, cfg);
        return message.reply("✅ Users will now receive a DM when they level up.");
      }
      if (val === "off") {
        cfg.dmOnLevelUp = false;
        setLevelConfig(guildId, cfg);
        return message.reply("✅ DM on level-up disabled.");
      }
      return message.reply("❌ Usage: `levelconfig dm on|off`");
    }

    if (sub === "message") {
      const text = args.slice(1).join(" ");
      if (!text || text.toLowerCase() === "off") {
        cfg.levelUpMessage = null;
        setLevelConfig(guildId, cfg);
        return message.reply("✅ Level-up message reset to default.");
      }
      cfg.levelUpMessage = text;
      setLevelConfig(guildId, cfg);
      return message.reply(
        `✅ Level-up message set to:\n> ${text}\n*Variables: \`{user}\`, \`{level}\`, \`{rank}\`*`,
      );
    }

    if (sub === "rolestack") {
      const val = args[1]?.toLowerCase();
      if (val === "on") {
        cfg.roleStack = true;
        setLevelConfig(guildId, cfg);
        return message.reply("✅ Role stacking enabled — users keep previous role rewards.");
      }
      if (val === "off") {
        cfg.roleStack = false;
        setLevelConfig(guildId, cfg);
        return message.reply("✅ Role replace mode — previous reward roles are removed on level-up.");
      }
      return message.reply("❌ Usage: `levelconfig rolestack on|off`");
    }

    if (sub === "reset") {
      setLevelConfig(guildId, { ...DEFAULT_CONFIG });
      return message.reply("✅ Leveling configuration reset to defaults.");
    }

    return message.reply(`❌ Unknown subcommand \`${sub}\`.\n\n${usage()}`);
  },
};
