import {
  Client,
  Message,
  PartialMessage,
  GuildMember,
  PartialGuildMember,
  GuildBan,
  NonThreadGuildBasedChannel,
  Role,
  VoiceState,
  AuditLogEvent,
  ChannelType,
} from "discord.js";
import { sendServerLog } from "../lib/serverlog";

// ── helpers ──────────────────────────────────────────────────────────────────

function truncate(str: string, max = 1024): string {
  if (!str) return "*empty*";
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

function channelTypeName(type: ChannelType): string {
  const map: Partial<Record<ChannelType, string>> = {
    [ChannelType.GuildText]: "Text",
    [ChannelType.GuildVoice]: "Voice",
    [ChannelType.GuildCategory]: "Category",
    [ChannelType.GuildAnnouncement]: "Announcement",
    [ChannelType.GuildStageVoice]: "Stage",
    [ChannelType.GuildForum]: "Forum",
    [ChannelType.GuildThread]: "Thread",
  };
  return map[type] ?? "Channel";
}

// ── registration ──────────────────────────────────────────────────────────────

export function registerServerLogEvents(client: Client) {

  // ── Messages ────────────────────────────────────────────────────────────────

  client.on("messageDelete", async (msg: Message | PartialMessage) => {
    if (!msg.guild || msg.author?.bot) return;
    await sendServerLog(client, msg.guild.id, {
      title: "🗑️ Message Deleted",
      color: 0xe74c3c,
      description: `Message by <@${msg.author?.id ?? "unknown"}> deleted in <#${msg.channelId}>`,
      fields: [
        { name: "Content", value: truncate(msg.content ?? "*unavailable*") },
        { name: "Author", value: `<@${msg.author?.id ?? "unknown"}> (${msg.author?.id ?? "?"})`, inline: true },
        { name: "Channel", value: `<#${msg.channelId}>`, inline: true },
      ],
    });
  });

  client.on("messageUpdate", async (oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) => {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    await sendServerLog(client, newMsg.guild.id, {
      title: "✏️ Message Edited",
      color: 0x3498db,
      description: `Message by <@${newMsg.author?.id}> edited in <#${newMsg.channelId}> — [Jump](${newMsg.url})`,
      fields: [
        { name: "Before", value: truncate(oldMsg.content ?? "*unavailable*") },
        { name: "After", value: truncate(newMsg.content ?? "*unavailable*") },
        { name: "Author", value: `<@${newMsg.author?.id}> (${newMsg.author?.id})`, inline: true },
        { name: "Channel", value: `<#${newMsg.channelId}>`, inline: true },
      ],
    });
  });

  // ── Members ─────────────────────────────────────────────────────────────────

  client.on("guildMemberAdd", async (member: GuildMember) => {
    const created = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
    await sendServerLog(client, member.guild.id, {
      title: "📥 Member Joined",
      color: 0x2ecc71,
      description: `<@${member.id}> joined the server`,
      fields: [
        { name: "User", value: `${member.user.tag} (${member.id})`, inline: true },
        { name: "Account Created", value: created, inline: true },
      ],
      footer: `Member #${member.guild.memberCount}`,
    });
  });

  client.on("guildMemberRemove", async (member: GuildMember | PartialGuildMember) => {
    await sendServerLog(client, member.guild.id, {
      title: "📤 Member Left",
      color: 0xe67e22,
      description: `<@${member.id}> left the server`,
      fields: [
        { name: "User", value: `${member.user?.tag ?? "Unknown"} (${member.id})`, inline: true },
        {
          name: "Roles",
          value: member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => `<@&${r.id}>`).join(", ") || "None",
          inline: true,
        },
      ],
    });
  });

  client.on("guildMemberUpdate", async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    const guildId = newMember.guild.id;

    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      await sendServerLog(client, guildId, {
        title: "🏷️ Nickname Changed",
        color: 0x9b59b6,
        description: `<@${newMember.id}>'s nickname was updated`,
        fields: [
          { name: "Before", value: oldMember.nickname ?? "*none*", inline: true },
          { name: "After", value: newMember.nickname ?? "*none*", inline: true },
        ],
      });
    }

    // Role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const added = newRoles.filter((r) => !oldRoles.has(r.id) && r.id !== newMember.guild.id);
    const removed = oldRoles.filter((r) => !newRoles.has(r.id) && r.id !== newMember.guild.id);

    if (added.size > 0 || removed.size > 0) {
      const fields = [];
      if (added.size > 0) fields.push({ name: "Roles Added", value: added.map((r) => `<@&${r.id}>`).join(", "), inline: true });
      if (removed.size > 0) fields.push({ name: "Roles Removed", value: removed.map((r) => `<@&${r.id}>`).join(", "), inline: true });
      await sendServerLog(client, guildId, {
        title: "🎭 Member Roles Updated",
        color: 0x1abc9c,
        description: `<@${newMember.id}>'s roles were changed`,
        fields,
      });
    }
  });

  // ── Bans ─────────────────────────────────────────────────────────────────────

  client.on("guildBanAdd", async (ban: GuildBan) => {
    let reason = ban.reason ?? "No reason provided";
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === ban.user.id) {
        reason = entry.reason ?? reason;
      }
    } catch { /* no audit log access */ }

    await sendServerLog(client, ban.guild.id, {
      title: "🔨 Member Banned",
      color: 0xe74c3c,
      description: `<@${ban.user.id}> was banned`,
      fields: [
        { name: "User", value: `${ban.user.tag} (${ban.user.id})`, inline: true },
        { name: "Reason", value: reason, inline: true },
      ],
    });
  });

  client.on("guildBanRemove", async (ban: GuildBan) => {
    await sendServerLog(client, ban.guild.id, {
      title: "✅ Member Unbanned",
      color: 0x2ecc71,
      description: `<@${ban.user.id}> was unbanned`,
      fields: [
        { name: "User", value: `${ban.user.tag} (${ban.user.id})`, inline: true },
      ],
    });
  });

  // ── Channels ─────────────────────────────────────────────────────────────────

  client.on("channelCreate", async (channel: NonThreadGuildBasedChannel) => {
    await sendServerLog(client, channel.guild.id, {
      title: "📢 Channel Created",
      color: 0x2ecc71,
      description: `A new ${channelTypeName(channel.type)} channel was created`,
      fields: [
        { name: "Name", value: `<#${channel.id}> (${channel.name})`, inline: true },
        { name: "Type", value: channelTypeName(channel.type), inline: true },
      ],
    });
  });

  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await sendServerLog(client, channel.guild.id, {
      title: "🗑️ Channel Deleted",
      color: 0xe74c3c,
      description: `A ${channelTypeName(channel.type)} channel was deleted`,
      fields: [
        { name: "Name", value: channel.name, inline: true },
        { name: "Type", value: channelTypeName(channel.type), inline: true },
      ],
    });
  });

  client.on("channelUpdate", async (oldCh, newCh) => {
    if (!("guild" in newCh) || !newCh.guild) return;
    const changes: string[] = [];
    if ("name" in oldCh && "name" in newCh && oldCh.name !== newCh.name)
      changes.push(`**Name:** \`${oldCh.name}\` → \`${newCh.name}\``);
    if ("topic" in oldCh && "topic" in newCh && oldCh.topic !== newCh.topic)
      changes.push(`**Topic:** ${oldCh.topic ?? "*none*"} → ${newCh.topic ?? "*none*"}`);
    if ("rateLimitPerUser" in oldCh && "rateLimitPerUser" in newCh && oldCh.rateLimitPerUser !== newCh.rateLimitPerUser)
      changes.push(`**Slowmode:** ${oldCh.rateLimitPerUser}s → ${newCh.rateLimitPerUser}s`);
    if (!changes.length) return;
    await sendServerLog(client, newCh.guild.id, {
      title: "✏️ Channel Updated",
      color: 0x3498db,
      description: `<#${newCh.id}> was updated\n\n${changes.join("\n")}`,
    });
  });

  // ── Roles ─────────────────────────────────────────────────────────────────────

  client.on("roleCreate", async (role: Role) => {
    await sendServerLog(client, role.guild.id, {
      title: "🎭 Role Created",
      color: 0x2ecc71,
      description: `New role created: <@&${role.id}>`,
      fields: [
        { name: "Name", value: role.name, inline: true },
        { name: "Color", value: role.hexColor, inline: true },
      ],
    });
  });

  client.on("roleDelete", async (role: Role) => {
    await sendServerLog(client, role.guild.id, {
      title: "🗑️ Role Deleted",
      color: 0xe74c3c,
      description: `Role deleted: **${role.name}**`,
      fields: [
        { name: "Name", value: role.name, inline: true },
        { name: "Color", value: role.hexColor, inline: true },
      ],
    });
  });

  client.on("roleUpdate", async (oldRole: Role, newRole: Role) => {
    const changes: string[] = [];
    if (oldRole.name !== newRole.name) changes.push(`**Name:** \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Color:** \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Hoisted:** ${oldRole.hoist} → ${newRole.hoist}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Mentionable:** ${oldRole.mentionable} → ${newRole.mentionable}`);
    if (!changes.length) return;
    await sendServerLog(client, newRole.guild.id, {
      title: "✏️ Role Updated",
      color: 0x9b59b6,
      description: `Role <@&${newRole.id}> was updated\n\n${changes.join("\n")}`,
    });
  });

  // ── Voice ─────────────────────────────────────────────────────────────────────

  client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
    const guildId = newState.guild.id;
    const member = newState.member;
    if (!member) return;

    if (!oldState.channelId && newState.channelId) {
      await sendServerLog(client, guildId, {
        title: "🔊 Joined Voice",
        color: 0x2ecc71,
        description: `<@${member.id}> joined <#${newState.channelId}>`,
        fields: [{ name: "Channel", value: `<#${newState.channelId}>`, inline: true }],
      });
    } else if (oldState.channelId && !newState.channelId) {
      await sendServerLog(client, guildId, {
        title: "🔇 Left Voice",
        color: 0xe67e22,
        description: `<@${member.id}> left <#${oldState.channelId}>`,
        fields: [{ name: "Channel", value: `<#${oldState.channelId}>`, inline: true }],
      });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await sendServerLog(client, guildId, {
        title: "🔀 Moved Voice Channel",
        color: 0x3498db,
        description: `<@${member.id}> moved voice channels`,
        fields: [
          { name: "From", value: `<#${oldState.channelId}>`, inline: true },
          { name: "To", value: `<#${newState.channelId}>`, inline: true },
        ],
      });
    }
  });
}
