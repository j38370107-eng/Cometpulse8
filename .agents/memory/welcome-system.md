---
name: Welcome system
description: Architecture and timing quirks for the welcoming system feature
---

## DB key
`"welcome"` in `bot_store`. Lazy per-guild cache in `store/welcome.ts` (`getWelcomeConfig` checks Map first, then hits DB once and caches).

## Timing quirk — invite tracking
`inviteTrack.ts` and `guildMemberAdd.ts` both listen on `guildMemberAdd`. Invite tracking is registered first but its `guild.invites.fetch()` is async. The welcome handler adds a **1200ms delay** before calling `getInviterForUser` so the invite is recorded before the welcome message is sent.

**Why:** Without the delay, the welcome embed showed "Invited by Unknown" even when tracking was working correctly, because `recordInvite` hadn't finished writing to the in-memory cache yet.

## guildMemberAdd.ts
Extends the existing mute re-apply handler — does NOT replace it. The mute logic runs first (with its own 500ms delay), then welcome logic runs independently.

## Fake invite detection
A leave within 1 hour of joining calls `markFakeLeave(guildId, userId)` in `store/invites.ts`. This increments `fakeCount` on the inviter's record. "Real" invites = `count - fakeCount`.

## InviteRecord shape change
Added `fakeCount: number` field. Old records from DB won't have it — code uses `?? 0` fallback everywhere.

## Dashboard route
`/api/guilds/:guildId/welcome` GET+PUT in `dashboard/server/routes/welcome.ts`. Invite leaderboard read directly from DB key `"invites"` (not from bot's in-memory cache).

## Bot commands added
- `c!invites [@user]` — invite stats for a user
- `c!whoinvited [@user]` — who invited a member
- `c!inviteleaderboard` — top inviters in the server
All in `commands/invites/` folder, registered in `commands/index.ts`, listed in `help.ts` under "Invites" category.
