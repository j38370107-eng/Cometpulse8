import type { Command } from "../types";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import {
  getCountingConfig,
  setCountingConfig,
  FailPunishment,
} from "../../store/counting";
import { getPrefix } from "../../store/prefixes";

export const countconfigCommand: Command = {
  name: "countconfig",
  aliases: ["countingsettings", "cconfig"],
  description: "Configure counting settings.",
  usage: "<setting> <value>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;
    const prefix = getPrefix(message.guild.id);
    const cfg = getCountingConfig(message.guild.id);
    const setting = args[0]?.toLowerCase();

    if (!setting) {
      const channelMention = cfg.channelId ? `<#${cfg.channelId}>` : "None";
      const embed = new EmbedBuilder()
        .setTitle("⚙️ Counting Configuration")
        .setColor(0x5865f2)
        .addFields(
          { name: "Channel", value: channelMention, inline: true },
          { name: "Mode", value: cfg.mode, inline: true },
          { name: "Reset on Fail", value: cfg.resetOnFail ? "✅ Yes" : "❌ No", inline: true },
          { name: "Delete Wrong", value: cfg.deleteWrong ? "✅ Yes" : "❌ No", inline: true },
          { name: "No Same User Twice", value: cfg.noSameUserTwice ? "✅ Yes" : "❌ No", inline: true },
          { name: "Update Topic", value: cfg.updateTopic ? "✅ Yes" : "❌ No", inline: true },
          { name: "Milestone Interval", value: cfg.milestoneInterval === 0 ? "Off" : String(cfg.milestoneInterval), inline: true },
          { name: "Milestone Emoji", value: cfg.milestoneEmoji, inline: true },
          { name: "Milestone Role", value: cfg.milestoneRoleId ? `<@&${cfg.milestoneRoleId}>` : "None", inline: true },
          { name: "React Emoji", value: cfg.reactEmoji, inline: true },
          { name: "Fail Punishment", value: cfg.failPunishment, inline: true },
          { name: "Checkpoint Interval", value: cfg.checkpointInterval === 0 ? "Off" : String(cfg.checkpointInterval), inline: true },
        )
        .setFooter({ text: `Use ${prefix}countconfig <setting> <value> to change a setting` });
      return message.reply({ embeds: [embed] });
    }

    const val = args.slice(1).join(" ");

    switch (setting) {
      case "reset":
      case "resetonfail":
        await setCountingConfig(message.guild.id, { resetOnFail: val === "on" || val === "true" });
        return message.reply(`✅ Reset on fail: **${val === "on" || val === "true" ? "enabled" : "disabled"}**`);

      case "delete":
      case "deletewrong":
        await setCountingConfig(message.guild.id, { deleteWrong: val === "on" || val === "true" });
        return message.reply(`✅ Delete wrong messages: **${val === "on" || val === "true" ? "enabled" : "disabled"}**`);

      case "sameuser":
      case "nosameuser":
        await setCountingConfig(message.guild.id, { noSameUserTwice: val === "on" || val === "true" });
        return message.reply(`✅ No same user twice: **${val === "on" || val === "true" ? "enabled" : "disabled"}**`);

      case "topic":
      case "updatetopic":
        await setCountingConfig(message.guild.id, { updateTopic: val === "on" || val === "true" });
        return message.reply(`✅ Update channel topic: **${val === "on" || val === "true" ? "enabled" : "disabled"}**`);

      case "milestone":
      case "milestoneinterval": {
        const n = parseInt(val);
        if (isNaN(n) || n < 0) return message.reply("❌ Please provide a number (0 to disable).");
        await setCountingConfig(message.guild.id, { milestoneInterval: n });
        return message.reply(`✅ Milestone interval: **${n === 0 ? "disabled" : `every ${n} counts`}**`);
      }

      case "milestonerole": {
        const role = message.mentions.roles.first() ?? (args[1] ? message.guild.roles.cache.get(args[1]) : null);
        if (val === "none" || val === "off") {
          await setCountingConfig(message.guild.id, { milestoneRoleId: null });
          return message.reply("✅ Milestone role cleared.");
        }
        if (!role) return message.reply("❌ Please mention a valid role.");
        await setCountingConfig(message.guild.id, { milestoneRoleId: role.id });
        return message.reply(`✅ Milestone role set to ${role}.`);
      }

      case "milestoneemoji":
        if (!val) return message.reply("❌ Please provide an emoji.");
        await setCountingConfig(message.guild.id, { milestoneEmoji: val });
        return message.reply(`✅ Milestone emoji set to ${val}`);

      case "reactemoji":
        if (!val) return message.reply("❌ Please provide an emoji.");
        await setCountingConfig(message.guild.id, { reactEmoji: val });
        return message.reply(`✅ React emoji set to ${val}`);

      case "punishment":
      case "failpunishment": {
        const punishments: FailPunishment[] = ["timeout", "warn", "nothing"];
        if (!punishments.includes(val as FailPunishment)) {
          return message.reply("❌ Valid options: `timeout`, `warn`, `nothing`");
        }
        await setCountingConfig(message.guild.id, { failPunishment: val as FailPunishment });
        return message.reply(`✅ Fail punishment set to **${val}**`);
      }

      case "checkpoint":
      case "checkpointinterval": {
        const n = parseInt(val);
        if (isNaN(n) || n < 0) return message.reply("❌ Please provide a number (0 to disable).");
        await setCountingConfig(message.guild.id, { checkpointInterval: n });
        return message.reply(`✅ Checkpoint interval: **${n === 0 ? "disabled" : `every ${n} counts`}**`);
      }

      default:
        return message.reply(
          `❌ Unknown setting \`${setting}\`. Valid settings: \`reset\`, \`delete\`, \`sameuser\`, \`topic\`, \`milestone\`, \`milestonerole\`, \`milestoneemoji\`, \`reactemoji\`, \`punishment\`, \`checkpoint\``
        );
    }
  },
};
