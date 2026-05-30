import type { Command } from "./types";
import { EmbedBuilder } from "discord.js";
import { getPrefix } from "../store/prefixes";

const CATEGORIES: { name: string; emoji: string; commands: string[] }[] = [
  {
    name: "General",
    emoji: "🔧",
    commands: ["help", "changeprefix"],
  },
  {
    name: "Leveling",
    emoji: "⚡",
    commands: [
      "rank",
      "leaderboard",
      "givexp",
      "setxp",
      "resetxp",
      "setlevel",
      "levelconfig",
      "xpexport",
      "xpimport",
    ],
  },
  {
    name: "Giveaways",
    emoji: "🎉",
    commands: ["gstart", "gend", "greroll", "glist", "gcancel", "gbonus"],
  },
  {
    name: "Invites",
    emoji: "📨",
    commands: ["invites", "whoinvited", "inviteleaderboard"],
  },
];

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
      const name = args[0].toLowerCase().replace(/^[^ ]+!/, "");
      const cmd: Command | undefined =
        commands.get(name) ??
        [...commands.values()].find((c) => c.aliases?.includes(name));

      if (!cmd) {
        return message.reply(
          `❌ No command called \`${name}\` found. Run \`${prefix}help\` to see all commands.`,
        );
      }

      const aliases =
        cmd.aliases?.length > 0
          ? cmd.aliases.map((a) => `\`${prefix}${a}\``).join(", ")
          : "None";

      const perms =
        cmd.requiredPermissions && cmd.requiredPermissions.length > 0
          ? cmd.requiredPermissions
              .map((p) => (typeof p === "bigint" ? permName(p) : String(p)))
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

    // ── Full command list (compact style) ─────────────────────────────────────
    const seen = new Set<string>();
    const categoryBlocks: string[] = [];
    let totalCommands = 0;

    for (const cat of CATEGORIES) {
      const names: string[] = [];
      for (const cmdName of cat.commands) {
        const cmd: Command | undefined = commands.get(cmdName);
        if (!cmd || seen.has(cmd.name)) continue;
        seen.add(cmd.name);
        names.push(cmd.name);
      }
      if (names.length > 0) {
        totalCommands += names.length;
        categoryBlocks.push(`${cat.emoji} **${cat.name}**\n${names.join(", ")}`);
      }
    }

    // Uncategorised fallback
    const extra: string[] = [];
    for (const [, cmd] of commands) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);
      extra.push(cmd.name);
      totalCommands++;
    }
    if (extra.length > 0) {
      categoryBlocks.push(`📦 **Other**\n${extra.join(", ")}`);
    }

    const activeCats =
      CATEGORIES.filter((c) => c.commands.some((n) => commands.has(n))).length +
      (extra.length > 0 ? 1 : 0);

    const description = [
      `**${totalCommands} commands** across **${activeCats} categories**.`,
      `Run \`${prefix}help [command]\` for details on any command.`,
      "",
      categoryBlocks.join("\n\n"),
    ].join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x7c3cfa)
      .setDescription(description);

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
