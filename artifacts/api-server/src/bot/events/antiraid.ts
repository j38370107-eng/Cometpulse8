import { Client, GuildMember, TextChannel, EmbedBuilder } from "discord.js";
import { getAntiRaid } from "../store/antiraid";
import { getLockdownChannels } from "../store/lockdown";
import { sendSecurityLog } from "../lib/securityLog";
import { logger } from "../../lib/logger";

// ── Recent joins per guild ────────────────────────────────────────────────────
const joinLog = new Map<string, { userId: string; userTag: string; joinedAt: number }[]>();

// Track guilds currently under raid response to avoid double-firing
const raidActive = new Set<string>();

// ── Registration ──────────────────────────────────────────────────────────────
export function registerAntiRaidEvents(client: Client) {
  client.on("guildMemberAdd", async (member: GuildMember) => {
    const cfg = getAntiRaid(member.guild.id);
    if (!cfg.enabled) return;

    const guildId = member.guild.id;
    const now = Date.now();

    // Record join
    const joins = (joinLog.get(guildId) ?? []).filter((j) => now - j.joinedAt < cfg.joinWindowMs);
    joins.push({ userId: member.id, userTag: member.user.tag, joinedAt: now });
    joinLog.set(guildId, joins);

    if (joins.length < cfg.joinThreshold) return;
    if (raidActive.has(guildId)) return;

    // ── Raid detected ─────────────────────────────────────────────────────────
    raidActive.add(guildId);
    const raidJoins = [...joins];
    joinLog.set(guildId, []);

    logger.warn({ guildId, count: raidJoins.length }, "Raid detected — taking action");

    const reason = `Anti-Raid: ${raidJoins.length} joins within ${cfg.joinWindowMs / 1000}s`;

    // ── Auto-lockdown ─────────────────────────────────────────────────────────
    const lockedChannels: string[] = [];
    if (cfg.lockdown) {
      const channelIds = getLockdownChannels(guildId);
      for (const id of channelIds) {
        try {
          const ch = (await member.guild.channels.fetch(id).catch(() => null)) as TextChannel | null;
          if (!ch || !("permissionOverwrites" in ch)) continue;
          await ch.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false });
          lockedChannels.push(id);
        } catch { /* skip */ }
      }
    }

    // ── Punish raiders ────────────────────────────────────────────────────────
    const punished: string[] = [];
    const failed: string[] = [];
    for (const { userId, userTag } of raidJoins) {
      try {
        const raider = await member.guild.members.fetch(userId).catch(() => null);
        if (!raider) continue;

        // DM before ban so the message can be delivered
        const actionDesc =
          cfg.action === "ban" ? "been banned from" :
          cfg.action === "kick" ? "been kicked from" :
          "been muted in";
        const dmEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`🚨 Anti-Raid Action — ${member.guild.name}`)
          .setDescription(
            `You have ${actionDesc} **${member.guild.name}** because the anti-raid system detected a mass-join raid and your account was flagged as part of it.`
          )
          .addFields(
            { name: "Action", value: `\`${cfg.action}\``, inline: true },
            { name: "Raid Size", value: `${raidJoins.length} joins`, inline: true },
            { name: "Window", value: `${cfg.joinWindowMs / 1000}s`, inline: true }
          )
          .setTimestamp();
        await raider.user.send({ embeds: [dmEmbed] }).catch(() => {});

        if (cfg.action === "ban") {
          await member.guild.members.ban(userId, { reason });
        } else if (cfg.action === "kick") {
          await raider.kick(reason);
        } else if (cfg.action === "mute") {
          await raider.timeout(60 * 60 * 1000, reason);
        }
        punished.push(`<@${userId}> (${userTag})`);
      } catch {
        failed.push(userId);
      }
    }

    // ── Security log ──────────────────────────────────────────────────────────
    const fields = [
      { name: "Action Taken", value: `\`${cfg.action}\``, inline: true },
      { name: "Raiders Detected", value: `${raidJoins.length}`, inline: true },
      { name: "Window", value: `${cfg.joinWindowMs / 1000}s`, inline: true },
      {
        name: `Punished (${punished.length})`,
        value: punished.length
          ? punished.slice(0, 10).join("\n") + (punished.length > 10 ? `\n…and ${punished.length - 10} more` : "")
          : "None",
      },
    ];

    if (failed.length) {
      fields.push({ name: `Failed (${failed.length})`, value: failed.map((id) => `<@${id}>`).join(", ") });
    }

    if (lockedChannels.length) {
      fields.push({
        name: "Channels Locked",
        value: lockedChannels.map((id) => `<#${id}>`).join(", "),
      });
    }

    await sendSecurityLog(client, guildId, cfg.logChannel, {
      title: "🚨 Anti-Raid — Raid Detected",
      color: 0xe74c3c,
      fields,
    });

    // Cool-down before allowing another raid trigger (30s)
    setTimeout(() => raidActive.delete(guildId), 30_000);
  });
}
