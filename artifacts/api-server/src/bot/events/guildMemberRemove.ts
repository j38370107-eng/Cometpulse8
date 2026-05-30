import { Client, EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import { logger } from "../../lib/logger";
import { getWelcomeConfig, replaceVars, formatDuration } from "../store/welcome";
import { getInviterForUser, markFakeLeave } from "../store/invites";

export function registerMemberLeave(client: Client) {
  client.on("guildMemberRemove", async (member) => {
    const guild = member.guild;
    logger.info({ memberId: member.id, guildId: guild.id }, "Member left");

    try {
      const cfg = await getWelcomeConfig(guild.id);

      // ── Fake invite detection (left within 1 hour of joining) ─────────────
      const joinedAt = member instanceof GuildMember ? member.joinedTimestamp : null;
      const durationMs = joinedAt ? Date.now() - joinedAt : null;
      if (durationMs !== null && durationMs < 60 * 60 * 1000) {
        markFakeLeave(guild.id, member.id);
      }

      if (!cfg.goodbyeEnabled || !cfg.goodbyeChannelId) return;

      const ch = guild.channels.cache.get(cfg.goodbyeChannelId) as TextChannel | undefined;
      if (!ch?.isTextBased()) return;

      // ── Build vars ────────────────────────────────────────────────────────
      const durationStr = durationMs != null ? formatDuration(durationMs) : "Unknown";

      const roles = (member instanceof GuildMember)
        ? member.roles.cache
            .filter((r) => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map((r) => r.name)
            .slice(0, 5)
            .join(", ") || "None"
        : "Unknown";

      const inviterRecord = getInviterForUser(guild.id, member.id);
      const inviterStr = inviterRecord ? `<@${inviterRecord.inviterId}>` : "Unknown";

      const vars: Record<string, string> = {
        user: member.user?.tag ?? "Unknown User",
        username: member.user?.username ?? "Unknown",
        server: guild.name,
        count: String(guild.memberCount),
        duration: durationStr,
        roles,
        inviter: inviterStr,
      };

      const text = replaceVars(cfg.goodbyeMessage, vars);

      if (cfg.goodbyeEmbed) {
        const color = parseInt(cfg.goodbyeEmbedColor.replace("#", ""), 16) || 0xef4444;
        const embed = new EmbedBuilder()
          .setColor(color)
          .setDescription(text);

        if (cfg.goodbyeEmbedTitle) embed.setTitle(replaceVars(cfg.goodbyeEmbedTitle, vars));
        if (cfg.goodbyeEmbedFooter) embed.setFooter({ text: replaceVars(cfg.goodbyeEmbedFooter, vars) });

        embed.addFields(
          { name: "Time in server", value: durationStr, inline: true },
          { name: "Top roles", value: roles, inline: true },
        );
        if (inviterRecord) embed.addFields({ name: "Invited by", value: inviterStr, inline: true });

        await (ch as TextChannel).send({ embeds: [embed] });
      } else {
        await (ch as TextChannel).send(text);
      }
    } catch (err) {
      logger.error({ err, memberId: member.id, guildId: guild.id }, "Goodbye system error");
    }
  });
}
