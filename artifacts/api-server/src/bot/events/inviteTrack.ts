import { Client, Guild } from "discord.js";
import { inviteCache, recordInvite } from "../store/invites";
import { logger } from "../../lib/logger";

export async function cacheGuildInvites(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map<
      string,
      { uses: number; inviterId: string; inviterTag: string }
    >();
    for (const invite of invites.values()) {
      if (invite.inviter) {
        map.set(invite.code, {
          uses: invite.uses ?? 0,
          inviterId: invite.inviter.id,
          inviterTag: invite.inviter.tag,
        });
      }
    }
    inviteCache.set(guild.id, map);
  } catch {
    // Bot may lack MANAGE_GUILD permission in this guild
  }
}

export function registerInviteTracking(client: Client): void {
  client.on("inviteCreate", (invite) => {
    if (!invite.guild) return;
    const map = inviteCache.get(invite.guild.id) ?? new Map();
    if (invite.inviter) {
      map.set(invite.code, {
        uses: invite.uses ?? 0,
        inviterId: invite.inviter.id,
        inviterTag: invite.inviter.tag,
      });
    }
    inviteCache.set(invite.guild.id, map);
  });

  client.on("inviteDelete", (invite) => {
    if (!invite.guild) return;
    inviteCache.get(invite.guild.id)?.delete(invite.code);
  });

  client.on("guildMemberAdd", async (member) => {
    const guild = member.guild;
    const cached = inviteCache.get(guild.id);
    if (!cached) return;

    try {
      const newInvites = await guild.invites.fetch();
      let usedEntry: { id: string; tag: string } | null = null;

      for (const invite of newInvites.values()) {
        const prev = cached.get(invite.code);
        if (prev && invite.inviter && (invite.uses ?? 0) > prev.uses) {
          usedEntry = { id: invite.inviter.id, tag: invite.inviter.tag };
          cached.set(invite.code, {
            uses: invite.uses ?? 0,
            inviterId: invite.inviter.id,
            inviterTag: invite.inviter.tag,
          });
          break;
        }
      }

      if (usedEntry) {
        recordInvite(guild.id, usedEntry.id, usedEntry.tag, member.id);
        logger.info(
          {
            guildId: guild.id,
            inviterId: usedEntry.id,
            joinedId: member.id,
          },
          "Invite tracked",
        );
      }

      for (const invite of newInvites.values()) {
        if (invite.inviter) {
          const existing = cached.get(invite.code);
          if (existing) existing.uses = invite.uses ?? 0;
        }
      }
    } catch {
      // Lacking permissions or rate limited
    }
  });

  client.on("guildCreate", async (guild) => {
    await cacheGuildInvites(guild);
  });
}
