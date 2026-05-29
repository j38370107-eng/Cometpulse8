import { EmbedBuilder, Message, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { getLevelConfig, setLevelConfig } from "../store/levels";

const USAGE = `levelconfig <subcommand> [args]

Subcommands:
  **status**               — Show current leveling config
  **enable / disable**     — Toggle the leveling system
  **channel <#channel|off>** — Set level-up announcement channel (off = same channel)
  **xprate <0.5–5>**       — XP multiplier (default: 1)
  **rolereward add <level> <@role>** — Give a role when a member reaches a level
  **rolereward remove <level>**      — Remove a role reward
  **noxp channel <#ch>**   — Stop XP gain in a channel
  **noxp channel remove <#ch>** — Allow XP again in a channel
  **noxp role <@role>**    — Stop XP gain for a role
  **noxp role remove <@role>** — Allow XP again for a role`;

export const levelConfigCommand: Command = {
  name: "levelconfig",
  aliases: ["lvlconfig", "levelsconfig"],
  description: "Configure the leveling system.",
  usage: USAGE,
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    const guildId = message.guild!.id;
    const sub = args[0]?.toLowerCase();

    const config = getLevelConfig(guildId);

    if (!sub || sub === "status") {
      const rewards =
        config.roleRewards.length > 0
          ? config.roleRewards
              .sort((a, b) => a.level - b.level)
              .map((r) => `Level ${r.level} → <@&${r.roleId}>`)
              .join("\n")
          : "None";

      const noXpChs =
        config.noXpChannels.length > 0
          ? config.noXpChannels.map((id) => `<#${id}>`).join(", ")
          : "None";

      const noXpRoles =
        config.noXpRoles.length > 0
          ? config.noXpRoles.map((id) => `<@&${id}>`).join(", ")
          : "None";

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("⚙️ Leveling Configuration")
        .addFields(
          { name: "Status", value: config.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
          {
            name: "XP Rate",
            value: `${config.xpRate}x (${Math.round(15 * config.xpRate)}–${Math.round(25 * config.xpRate)} XP/msg)`,
            inline: true,
          },
          {
            name: "Level-up Channel",
            value: config.channelId ? `<#${config.channelId}>` : "Same channel as message",
            inline: true,
          },
          { name: "Role Rewards", value: rewards },
          { name: "No-XP Channels", value: noXpChs, inline: true },
          { name: "No-XP Roles", value: noXpRoles, inline: true },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (sub === "enable") {
      config.enabled = true;
      setLevelConfig(guildId, config);
      return message.reply("✅ Leveling system **enabled**.").catch(() => {});
    }

    if (sub === "disable") {
      config.enabled = false;
      setLevelConfig(guildId, config);
      return message.reply("✅ Leveling system **disabled**.").catch(() => {});
    }

    if (sub === "channel") {
      const val = args[1]?.toLowerCase();
      if (val === "off" || val === "none") {
        config.channelId = null;
        setLevelConfig(guildId, config);
        return message
          .reply("✅ Level-up announcements will appear in the same channel as the message.")
          .catch(() => {});
      }
      const ch =
        message.mentions.channels.first() ??
        (args[1] ? message.guild!.channels.cache.get(args[1]) : null);
      if (!ch) {
        return message
          .reply("❌ Please mention a valid channel, or use `off` to disable.")
          .catch(() => {});
      }
      config.channelId = ch.id;
      setLevelConfig(guildId, config);
      return message
        .reply(`✅ Level-up announcements will be sent to <#${ch.id}>.`)
        .catch(() => {});
    }

    if (sub === "xprate") {
      const rate = parseFloat(args[1] ?? "");
      if (isNaN(rate) || rate < 0.1 || rate > 10) {
        return message.reply("❌ XP rate must be between 0.1 and 10.").catch(() => {});
      }
      config.xpRate = Math.round(rate * 10) / 10;
      setLevelConfig(guildId, config);
      return message.reply(`✅ XP rate set to **${config.xpRate}x**.`).catch(() => {});
    }

    if (sub === "rolereward") {
      const action = args[1]?.toLowerCase();

      if (action === "add") {
        const level = parseInt(args[2] ?? "", 10);
        const role = message.mentions.roles.first();
        if (isNaN(level) || level < 1 || !role) {
          return message
            .reply("❌ Usage: `levelconfig rolereward add <level> <@role>`")
            .catch(() => {});
        }
        config.roleRewards = config.roleRewards.filter((r) => r.level !== level);
        config.roleRewards.push({ level, roleId: role.id });
        setLevelConfig(guildId, config);
        return message
          .reply(`✅ Members who reach level **${level}** will receive <@&${role.id}>.`)
          .catch(() => {});
      }

      if (action === "remove") {
        const level = parseInt(args[2] ?? "", 10);
        if (isNaN(level)) {
          return message
            .reply("❌ Usage: `levelconfig rolereward remove <level>`")
            .catch(() => {});
        }
        config.roleRewards = config.roleRewards.filter((r) => r.level !== level);
        setLevelConfig(guildId, config);
        return message
          .reply(`✅ Removed role reward for level **${level}**.`)
          .catch(() => {});
      }

      return message
        .reply("❌ Usage: `levelconfig rolereward add <level> <@role>` or `rolereward remove <level>`")
        .catch(() => {});
    }

    if (sub === "noxp") {
      const type = args[1]?.toLowerCase();
      const removing = args[2]?.toLowerCase() === "remove";

      if (type === "channel") {
        const ch =
          message.mentions.channels.first() ??
          (args[removing ? 3 : 2]
            ? message.guild!.channels.cache.get(args[removing ? 3 : 2]!)
            : null);
        if (!ch) {
          return message
            .reply("❌ Usage: `levelconfig noxp channel <#channel>` or `noxp channel remove <#channel>`")
            .catch(() => {});
        }
        if (removing) {
          config.noXpChannels = config.noXpChannels.filter((id) => id !== ch.id);
          setLevelConfig(guildId, config);
          return message.reply(`✅ XP is now allowed in <#${ch.id}>.`).catch(() => {});
        }
        if (!config.noXpChannels.includes(ch.id)) config.noXpChannels.push(ch.id);
        setLevelConfig(guildId, config);
        return message.reply(`✅ XP is now blocked in <#${ch.id}>.`).catch(() => {});
      }

      if (type === "role") {
        const role =
          message.mentions.roles.first() ??
          (args[removing ? 3 : 2]
            ? message.guild!.roles.cache.get(args[removing ? 3 : 2]!)
            : null);
        if (!role) {
          return message
            .reply("❌ Usage: `levelconfig noxp role <@role>` or `noxp role remove <@role>`")
            .catch(() => {});
        }
        if (removing) {
          config.noXpRoles = config.noXpRoles.filter((id) => id !== role.id);
          setLevelConfig(guildId, config);
          return message.reply(`✅ <@&${role.id}> can now earn XP.`).catch(() => {});
        }
        if (!config.noXpRoles.includes(role.id)) config.noXpRoles.push(role.id);
        setLevelConfig(guildId, config);
        return message.reply(`✅ <@&${role.id}> will no longer earn XP.`).catch(() => {});
      }

      return message
        .reply("❌ Usage: `levelconfig noxp channel <#ch>` or `levelconfig noxp role <@role>`")
        .catch(() => {});
    }

    return message
      .reply(`❌ Unknown subcommand. Usage:\n\`\`\`\n${USAGE}\n\`\`\``)
      .catch(() => {});
  },
};
