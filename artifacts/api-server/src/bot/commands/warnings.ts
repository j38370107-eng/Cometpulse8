import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { getInfractions, clearInfractions, getActiveAutomodWarnCount } from "../store/infractions";
import { resolveTarget } from "../lib/resolveUser";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatExpiry(expiresAt: number | undefined): string {
  if (!expiresAt) return "";
  const now = Date.now();
  if (expiresAt <= now) return " (expired)";
  const diff = expiresAt - now;
  const days = Math.ceil(diff / 86400000);
  if (days === 1) return " (expires tomorrow)";
  if (days < 30) return ` (expires in ${days} days)`;
  const months = Math.ceil(days / 30);
  return ` (expires in ${months === 1 ? "a month" : `${months} months`})`;
}

function isModerator(message: Message): boolean {
  if (!message.member) return false;
  return (
    message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

export const warningsCommand: Command = {
  name: "warnings",
  aliases: ["warns", "modlogs", "infractions", "punishments", "cases", "hist", "history", "warnsa"],
  description: "Show your infractions, or any user's if you are a moderator",
  usage: "[@user | userID] [-a] [clear]",

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const isMod = isModerator(message);
    const prefix = (message.client as any).prefix ?? ">";
    const invokedAs = message.content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    const automodOnly = args.includes("-a") || invokedAs === "warnsa";

    // Strip flags before resolving target
    const nonFlagArgs = args.filter((a) => !a.startsWith("-"));

    let target = message.author;

    if (nonFlagArgs.length > 0) {
      const resolved = await resolveTarget(message, nonFlagArgs);
      if (resolved) {
        if (!isMod && resolved.user.id !== message.author.id) {
          return message.reply("❌ You can only view your own infractions.");
        }
        target = resolved.user;
      }
    }

    const shouldClear = nonFlagArgs.includes("clear");
    if (shouldClear) {
      if (!isMod) return message.reply("❌ You don't have permission to clear infractions.");
      clearInfractions(message.guild.id, target.id);
      return message.reply(`✅ All infractions for **${target.tag}** have been cleared.`);
    }

    const allInfractions = getInfractions(message.guild.id, target.id);
    let infractions: typeof allInfractions;

    // -a flag: show automod-only; members can only view their own
    if (automodOnly) {
      if (!isMod && target.id !== message.author.id) {
        return message.reply("❌ You can only view your own AutoMod infractions.");
      }
      // Notes are never shown here — use >viewnotes to view staff notes
      const base = allInfractions.filter((i) => i.type !== "Note");
      infractions = base.filter((i) => i.automod === true);
    } else {
      // Regular view: exclude automod entries and notes entirely
      // Notes can only be seen via >viewnotes
      const base = allInfractions.filter((i) => i.type !== "Note");
      infractions = base.filter((i) => !i.automod);
    }

    const modeLabel = automodOnly ? "AutoMod infractions" : "infractions";

    if (infractions.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .setDescription(
          isMod
            ? `Showing ${modeLabel} for ${target}.\n\n*No ${modeLabel} found.*`
            : `You have no infractions on record.`
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const lines = infractions.map((inf) => {
      const expiry = formatExpiry(inf.expiresAt);
      const modLine = isMod ? ` — *by ${inf.moderatorTag}*` : "";
      return `**ID: ${inf.id}**\n${inf.type} — ${inf.reason} — ${formatDate(inf.timestamp)}${expiry}${modLine}`;
    });

    const chunkLines: string[][] = [[]];
    for (const line of lines) {
      const current = chunkLines[chunkLines.length - 1]!;
      if ((current.join("\n\n") + "\n\n" + line).length > 3900) {
        chunkLines.push([line]);
      } else {
        current.push(line);
      }
    }

    const activeCount = automodOnly
      ? getActiveAutomodWarnCount(message.guild.id, target.id)
      : null;

    const headerText = isMod
      ? `Showing ${modeLabel} for ${target}.${activeCount !== null ? ` **${activeCount} active.**` : ""}\n\n`
      : `Showing your infractions.\n\n`;

    for (let i = 0; i < chunkLines.length; i++) {
      const footerParts: string[] = [`${infractions.length} ${modeLabel}`];
      if (activeCount !== null) footerParts.push(`${activeCount} active`);
      if (!isMod) footerParts.push("Moderator hidden");

      const embed = new EmbedBuilder()
        .setColor(automodOnly ? 0xf39c12 : 0x5865f2)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .setDescription((i === 0 ? headerText : "") + chunkLines[i]!.join("\n\n"))
        .setFooter({ text: footerParts.join(" • ") })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
    }
  },
};
