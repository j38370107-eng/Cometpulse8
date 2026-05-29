import type { Command } from "./types";
import { EmbedBuilder } from "discord.js";
import { getPrefix } from "../store/prefixes";

const CATEGORIES: Record<string, { emoji: string; names: string[] }> = {
  General: {
    emoji: "🔧",
    names: ["help", "changeprefix"],
  },
  Leveling: {
    emoji: "⚡",
    names: [
      "rank",
      "leaderboard",
      "levelconfig",
      "givexp",
      "setxp",
      "setlevel",
      "resetxp",
      "xpexport",
      "xpimport",
    ],
  },
};

export const helpCommand: Command = {
  name: "help",
  aliases: ["h", "commands", "cmds"],
  description: "Show all commands, or detailed info about one command.",
  usage: "[command]",
  async execute(message, args) {
    if (!message.guild) return;

    const prefix = getPrefix(message.guild.id);
    const client = message.client as any;
    const commands: Map<string, Command> = client.commands;

    // ── Specific command lookup ───────────────────────────────────────────────
    if (args[0]) {
      const name = args[0].toLowerCase().replace(/^c!/, "");
      const cmd: Command | undefined = commands.get(name);
      if (!cmd) {
        return message.reply(
          `❌ No command called \`${name}\` found. Run \`${prefix}help\` to see all commands.`,
        );
      }

      const aliases =
        cmd.aliases.length > 0
          ? cmd.aliases.map((a) => `\`${prefix}${a}\``).join(", ")
          : "None";

      const perms =
        cmd.requiredPermissions && cmd.requiredPermissions.length > 0
          ? cmd.requiredPermissions
              .map((p) =>
                typeof p === "bigint"
                  ? permName(p)
                  : String(p),
              )
              .join(", ")
          : "None";

      const embed = new EmbedBuilder()
        .setTitle(`${prefix}${cmd.name}`)
        .setColor(0x7c3cfa)
        .setDescription(cmd.description)
        .addFields(
          {
            name: "Usage",
            value: `\`${prefix}${cmd.name}${cmd.usage ? " " + cmd.usage : ""}\``,
            inline: false,
          },
          { name: "Aliases", value: aliases, inline: true },
          { name: "Required Permissions", value: perms, inline: true },
        );

      return message.channel.send({ embeds: [embed] });
    }

    // ── Full command list ─────────────────────────────────────────────────────
    const seen = new Set<string>();
    const fields: { name: string; value: string; inline: boolean }[] = [];

    for (const [catName, cat] of Object.entries(CATEGORIES)) {
      const lines: string[] = [];
      for (const cmdName of cat.names) {
        if (seen.has(cmdName)) continue;
        const cmd: Command | undefined = commands.get(cmdName);
        if (!cmd) continue;
        seen.add(cmd.name);
        const usage = cmd.usage ? ` ${cmd.usage}` : "";
        lines.push(`\`${prefix}${cmd.name}${usage}\` — ${cmd.description}`);
      }
      if (lines.length > 0) {
        fields.push({
          name: `${cat.emoji} ${catName}`,
          value: lines.join("\n"),
          inline: false,
        });
      }
    }

    // Any commands not in a category
    const uncategorised: string[] = [];
    for (const [, cmd] of commands) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);
      const usage = cmd.usage ? ` ${cmd.usage}` : "";
      uncategorised.push(`\`${prefix}${cmd.name}${usage}\` — ${cmd.description}`);
    }
    if (uncategorised.length > 0) {
      fields.push({
        name: "📦 Other",
        value: uncategorised.join("\n"),
        inline: false,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("CometPulse — Command List")
      .setColor(0x7c3cfa)
      .setDescription(
        `Use \`${prefix}help <command>\` for detailed info on any command.\nCurrent prefix: \`${prefix}\``,
      )
      .addFields(fields)
      .setFooter({
        text: `${seen.size} commands total`,
        iconURL: message.client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  },
};

function permName(perm: bigint): string {
  const map: Record<string, string> = {
    "8": "Administrator",
    "32": "ManageGuild",
    "8192": "ManageMessages",
    "268435456": "ManageRoles",
    "4": "BanMembers",
    "2": "KickMembers",
  };
  return map[String(perm)] ?? `Permission(${perm})`;
}
