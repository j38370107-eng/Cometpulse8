import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { logger } from "../../lib/logger";
import { getTimedMute } from "../store/timedMutes";
import { getMuteConfig } from "../store/muteConfig";
import { getWelcomeConfig, replaceVars } from "../store/welcome";
import { getInviterForUser } from "../store/invites";

export function registerMemberJoin(client: Client) {
  client.on("guildMemberAdd", async (member) => {
    const guild = member.guild;
    logger.info({ memberId: member.id, guildId: guild.id }, "Member joined");

    // ── Re-apply active mute if the member had one when they left ────────────
    const timedMute = getTimedMute(guild.id, member.id);
    if (timedMute) {
      const remaining = timedMute.expiresAt - Date.now();
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, 500));
        const freshMember = await guild.members.fetch(member.id).catch(() => member);
        const muteCfg = getMuteConfig(guild.id);
        try {
          if (muteCfg.mode === "role" && muteCfg.muteRoleId) {
            if (muteCfg.stripRoles) {
              await freshMember.roles.set([muteCfg.muteRoleId], "Mute re-applied on rejoin");
            } else {
              await freshMember.roles.add(muteCfg.muteRoleId, "Mute re-applied on rejoin");
            }
          } else {
            const cappedMs = Math.min(remaining, 7 * 24 * 60 * 60 * 1000);
            await freshMember.timeout(cappedMs, "Mute re-applied on rejoin");
          }
        } catch (err) {
          logger.error({ err, memberId: member.id, guildId: guild.id }, "Failed to re-apply mute on rejoin");
        }
      }
    }

    // ── Welcome system ───────────────────────────────────────────────────────
    try {
      const cfg = await getWelcomeConfig(guild.id);

      // Small delay so invite tracking has time to record the invite
      await new Promise((r) => setTimeout(r, 1200));

      const inviterRecord = getInviterForUser(guild.id, member.id);
      const inviterMention = inviterRecord ? `<@${inviterRecord.inviterId}>` : "Unknown";
      const inviterTag = inviterRecord ? inviterRecord.inviterTag : "Unknown";

      const vars: Record<string, string> = {
        user: `<@${member.id}>`,
        username: member.user.username,
        server: guild.name,
        count: String(guild.memberCount),
        inviter: inviterMention,
        inviterTag,
      };

      // ── Auto-role ──────────────────────────────────────────────────────────
      if (cfg.autoRoleEnabled) {
        const rolesToAdd = member.user.bot ? cfg.botAutoRoles : cfg.autoRoles;
        for (const roleId of rolesToAdd) {
          await member.roles.add(roleId, "Auto-role on join").catch(() => {});
        }
      }

      // ── DM welcome ────────────────────────────────────────────────────────
      if (cfg.dmEnabled && !member.user.bot) {
        const dmText = replaceVars(cfg.dmMessage, vars);
        await member.user.send(dmText).catch(() => {});
      }

      // ── Welcome channel message ───────────────────────────────────────────
      if (cfg.welcomeEnabled && cfg.welcomeChannelId) {
        const ch = guild.channels.cache.get(cfg.welcomeChannelId) as TextChannel | undefined;
        if (ch?.isTextBased()) {
          const text = replaceVars(cfg.welcomeMessage, vars);

          if (cfg.welcomeEmbed) {
            const color = parseInt(cfg.welcomeEmbedColor.replace("#", ""), 16) || 0x7c3cfa;
            const embed = new EmbedBuilder()
              .setColor(color)
              .setDescription(text)
              .setThumbnail(member.user.displayAvatarURL());

            if (cfg.welcomeEmbedTitle) embed.setTitle(replaceVars(cfg.welcomeEmbedTitle, vars));
            if (cfg.welcomeEmbedFooter) embed.setFooter({ text: replaceVars(cfg.welcomeEmbedFooter, vars) });
            if (cfg.showInviter && inviterRecord) {
              embed.addFields({ name: "Invited by", value: inviterMention, inline: true });
            }

            await (ch as TextChannel).send({ embeds: [embed] });
          } else {
            const extra = cfg.showInviter && inviterRecord ? `\nInvited by ${inviterMention}` : "";
            await (ch as TextChannel).send(text + extra);
          }
        }
      }
    } catch (err) {
      logger.error({ err, memberId: member.id, guildId: guild.id }, "Welcome system error");
    }
  });
}
