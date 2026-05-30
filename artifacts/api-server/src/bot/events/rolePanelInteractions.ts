import {
  Client,
  ButtonInteraction,
  StringSelectMenuInteraction,
  MessageReaction,
  User,
  GuildMember,
  TextChannel,
  EmbedBuilder,
  PartialMessageReaction,
  PartialUser,
} from "discord.js";
import { getPanel, getGuildPanels, messagePanelIndex, RolePanel, RolePanelRole } from "../store/rolePanel";
import { addTimedRole } from "../store/timedRoles";
import { logger } from "../../lib/logger";

const STORE_NAME = "levels";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserLevel(guildId: string, userId: string): Promise<number> {
  try {
    const { dbGet } = await import("../store/db");
    const data = await dbGet<any>(STORE_NAME, `${guildId}:${userId}`);
    return data?.level ?? 0;
  } catch {
    return 0;
  }
}

async function checkRestrictions(
  panel: RolePanel,
  member: GuildMember,
): Promise<string | null> {
  const r = panel.restrictions;

  if (r.minAccountAgeDays > 0) {
    const ageMs = Date.now() - member.user.createdTimestamp;
    const ageDays = ageMs / 86_400_000;
    if (ageDays < r.minAccountAgeDays) {
      return `❌ Your account must be at least **${r.minAccountAgeDays} days old** to use this panel.`;
    }
  }

  if (r.blacklistRoles.length > 0) {
    const hasBlacklist = r.blacklistRoles.some((id) => member.roles.cache.has(id));
    if (hasBlacklist) return "❌ You are not allowed to use this role panel.";
  }

  if (r.requiredRoles.length > 0) {
    const hasRequired = r.requiredRoles.some((id) => member.roles.cache.has(id));
    if (!hasRequired) return "❌ You must have a required role to use this panel.";
  }

  if (r.requiredLevel > 0) {
    const level = await getUserLevel(member.guild.id, member.id);
    if (level < r.requiredLevel) {
      return `❌ You must be at least **level ${r.requiredLevel}** to use this panel.`;
    }
  }

  return null;
}

function countPanelRolesHeld(panel: RolePanel, member: GuildMember): number {
  return panel.roles.filter((r) => member.roles.cache.has(r.roleId)).length;
}

async function applyRole(
  panel: RolePanel,
  role: RolePanelRole,
  member: GuildMember,
): Promise<{ action: "added" | "removed" | "already" | "maxed"; roleId: string }> {
  const hasRole = member.roles.cache.has(role.roleId);

  // Restrictions: max roles per panel
  if (!hasRole && panel.restrictions.maxRoles > 0) {
    const held = countPanelRolesHeld(panel, member);
    if (held >= panel.restrictions.maxRoles) {
      return { action: "maxed", roleId: role.roleId };
    }
  }

  // Role-level required roles check
  if (!hasRole && role.requiredRoles.length > 0) {
    const hasReq = role.requiredRoles.some((id) => member.roles.cache.has(id));
    if (!hasReq) {
      return { action: "maxed", roleId: role.roleId }; // reuse maxed for "denied"
    }
  }

  switch (panel.mode) {
    case "toggle":
    case "reversed": {
      if (hasRole) {
        await member.roles.remove(role.roleId, "Role panel");
        return { action: "removed", roleId: role.roleId };
      } else {
        await member.roles.add(role.roleId, "Role panel");
        for (const bundleId of role.bundleRoles) {
          await member.roles.add(bundleId, "Role panel bundle").catch(() => {});
        }
        if (role.duration > 0) {
          await addTimedRole(member.guild.id, {
            userId: member.id,
            roleId: role.roleId,
            expiresAt: Date.now() + role.duration,
            panelId: panel.id,
          });
        }
        return { action: "added", roleId: role.roleId };
      }
    }

    case "exclusive": {
      // Remove all other panel roles
      for (const r of panel.roles) {
        if (r.roleId !== role.roleId && member.roles.cache.has(r.roleId)) {
          await member.roles.remove(r.roleId, "Role panel exclusive").catch(() => {});
        }
      }
      if (!hasRole) {
        await member.roles.add(role.roleId, "Role panel");
        for (const bundleId of role.bundleRoles) {
          await member.roles.add(bundleId, "Role panel bundle").catch(() => {});
        }
      }
      return { action: hasRole ? "already" : "added", roleId: role.roleId };
    }

    case "verify": {
      if (hasRole) return { action: "already", roleId: role.roleId };
      await member.roles.add(role.roleId, "Role panel verify");
      for (const bundleId of role.bundleRoles) {
        await member.roles.add(bundleId, "Role panel bundle").catch(() => {});
      }
      return { action: "added", roleId: role.roleId };
    }
  }
}

async function sendLog(panel: RolePanel, member: GuildMember, action: string, roleName: string): Promise<void> {
  if (!panel.logChannelId) return;
  try {
    const ch = member.guild.channels.cache.get(panel.logChannelId) as TextChannel | undefined;
    if (!ch?.isTextBased()) return;
    const color = action === "added" ? 0x10b981 : 0xef4444;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Role Panel — ${action === "added" ? "Role Added" : "Role Removed"}`)
      .addFields(
        { name: "User", value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: "Role", value: roleName, inline: true },
        { name: "Panel", value: panel.title || panel.id, inline: true },
      )
      .setTimestamp();
    await (ch as TextChannel).send({ embeds: [embed] });
  } catch {}
}

function replyMsg(action: string, roleId: string, maxRoles: number): string {
  switch (action) {
    case "added": return `✅ You've been given <@&${roleId}>.`;
    case "removed": return `🗑️ Removed <@&${roleId}> from you.`;
    case "already": return `ℹ️ You already have this role and it cannot be removed.`;
    case "maxed":
      return maxRoles > 0
        ? `❌ You can only hold **${maxRoles}** role(s) from this panel.`
        : `❌ You don't meet the requirements for this role.`;
    default: return "✅ Done!";
  }
}

// ── Button handler ────────────────────────────────────────────────────────────

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  // customId: rp:btn:<panelId>:<roleId>
  const [, , panelId, roleId] = interaction.customId.split(":");
  const guildId = interaction.guildId!;
  const panel = getPanel(guildId, panelId);
  if (!panel) return interaction.reply({ content: "❌ Panel not found.", ephemeral: true }).then(() => {}) as any;

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return interaction.editReply("❌ Could not verify your membership.").then(() => {});

  const deny = await checkRestrictions(panel, member);
  if (deny) return interaction.editReply(deny).then(() => {});

  const role = panel.roles.find((r) => r.roleId === roleId);
  if (!role) return interaction.editReply("❌ Role not found in panel.").then(() => {});

  const result = await applyRole(panel, role, member);
  const roleName = member.guild.roles.cache.get(roleId)?.name ?? roleId;
  if (result.action === "added" || result.action === "removed") {
    await sendLog(panel, member, result.action, roleName);
  }

  return interaction.editReply(replyMsg(result.action, roleId, panel.restrictions.maxRoles)).then(() => {});
}

// ── Dropdown handler ──────────────────────────────────────────────────────────

async function handleDropdown(interaction: StringSelectMenuInteraction): Promise<void> {
  // customId: rp:sel:<panelId>
  const [, , panelId] = interaction.customId.split(":");
  const guildId = interaction.guildId!;
  const panel = getPanel(guildId, panelId);
  if (!panel) return interaction.reply({ content: "❌ Panel not found.", ephemeral: true }).then(() => {});

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return interaction.editReply("❌ Could not verify your membership.").then(() => {});

  const deny = await checkRestrictions(panel, member);
  if (deny) return interaction.editReply(deny).then(() => {});

  const selected = new Set(interaction.values);
  const lines: string[] = [];

  if (panel.mode === "exclusive") {
    // Remove all panel roles not selected
    for (const r of panel.roles) {
      if (!selected.has(r.roleId) && member.roles.cache.has(r.roleId)) {
        await member.roles.remove(r.roleId, "Role panel exclusive").catch(() => {});
        const roleName = member.guild.roles.cache.get(r.roleId)?.name ?? r.roleId;
        lines.push(`🗑️ Removed <@&${r.roleId}>`);
        await sendLog(panel, member, "removed", roleName);
      }
    }
    if (selected.size > 0) {
      const roleId = [...selected][0]!;
      const role = panel.roles.find((r) => r.roleId === roleId);
      if (role && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId, "Role panel").catch(() => {});
        lines.push(`✅ Given <@&${roleId}>`);
        const roleName = member.guild.roles.cache.get(roleId)?.name ?? roleId;
        await sendLog(panel, member, "added", roleName);
      }
    }
  } else {
    // Toggle all panel roles based on selection
    for (const role of panel.roles) {
      const wantsIt = selected.has(role.roleId);
      const hasIt = member.roles.cache.has(role.roleId);

      if (wantsIt && !hasIt) {
        const result = await applyRole(panel, role, member);
        if (result.action === "added") {
          lines.push(`✅ Given <@&${role.roleId}>`);
          const roleName = member.guild.roles.cache.get(role.roleId)?.name ?? role.roleId;
          await sendLog(panel, member, "added", roleName);
        } else if (result.action === "maxed") {
          lines.push(`❌ Could not give <@&${role.roleId}> — requirements not met or max reached.`);
        }
      } else if (!wantsIt && hasIt && panel.mode !== "verify") {
        await member.roles.remove(role.roleId, "Role panel").catch(() => {});
        lines.push(`🗑️ Removed <@&${role.roleId}>`);
        const roleName = member.guild.roles.cache.get(role.roleId)?.name ?? role.roleId;
        await sendLog(panel, member, "removed", roleName);
      }
    }
  }

  return interaction.editReply(lines.length > 0 ? lines.join("\n") : "No changes made.").then(() => {});
}

// ── Reaction handler ─────────────────────────────────────────────────────────

async function handleReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  added: boolean,
): Promise<void> {
  if (user.bot) return;
  const messageId = reaction.message.id;
  const entry = messagePanelIndex.get(messageId);
  if (!entry) return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const panel = getPanel(entry.guildId, entry.panelId);
  if (!panel || panel.type !== "reaction") return;

  const emojiId = reaction.emoji.id ?? reaction.emoji.name ?? "";
  const role = panel.roles.find(
    (r) => r.emoji === emojiId || r.emoji === reaction.emoji.name || r.emoji === `<:${reaction.emoji.name}:${reaction.emoji.id}>`,
  );
  if (!role) return;

  try {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const deny = await checkRestrictions(panel, member);
    if (deny) {
      // Remove the reaction silently if denied
      await reaction.users.remove(user.id).catch(() => {});
      return;
    }

    const hasRole = member.roles.cache.has(role.roleId);

    if (added) {
      if (!hasRole) {
        await applyRole(panel, role, member);
        const roleName = guild.roles.cache.get(role.roleId)?.name ?? role.roleId;
        await sendLog(panel, member, "added", roleName);
      }
    } else {
      if (hasRole && panel.mode !== "verify") {
        await member.roles.remove(role.roleId, "Role panel reaction").catch(() => {});
        const roleName = guild.roles.cache.get(role.roleId)?.name ?? role.roleId;
        await sendLog(panel, member, "removed", roleName);
      }
    }
  } catch (err) {
    logger.error({ err, messageId, emojiId }, "Reaction role error");
  }
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerRolePanelInteractions(client: Client): void {
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith("rp:btn:")) {
      await handleButton(interaction as ButtonInteraction).catch((err) =>
        logger.error({ err }, "Role panel button error")
      );
    } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith("rp:sel:")) {
      await handleDropdown(interaction as StringSelectMenuInteraction).catch((err) =>
        logger.error({ err }, "Role panel dropdown error")
      );
    }
  });

  client.on("messageReactionAdd", (reaction, user) => {
    handleReaction(reaction, user, true).catch(() => {});
  });

  client.on("messageReactionRemove", (reaction, user) => {
    handleReaction(reaction, user, false).catch(() => {});
  });
}
