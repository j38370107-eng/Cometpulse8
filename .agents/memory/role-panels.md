---
name: Role panels system
description: Architecture, posting flow, and interaction patterns for the role panels feature
---

## DB key
`"rolePanels"` — stored per guild as `Record<panelId, RolePanel>` under one key per guildId.

## Message index
`messagePanelIndex` is a `Map<messageId, { guildId, panelId }>` rebuilt at startup via `rebuildMessageIndex()` (called in `bot/index.ts` after `initAllStores()`). Updated live via `indexPanel(panel)` whenever a panel is posted.

## Posting flow
1. Dashboard calls `POST /api/guilds/:guildId/role-panels/:panelId/post`
2. Dashboard server proxies to bot at `http://localhost:${BOT_PORT}/internal/post-role-panel/:guildId/:panelId`
3. Bot's `app.ts` endpoint uses `_panelClient` (set via `setPanelClient(client)` in `index.ts`) to send the message
4. messageId saved back to DB + in-memory cache via `savePanel` + `indexPanel`

**Why:** Bot and dashboard run in separate processes sharing the same DB; the internal HTTP proxy is the same pattern used for giveaways.

## Custom IDs
- Buttons: `rp:btn:<panelId>:<roleId>`
- Dropdowns: `rp:sel:<panelId>`
- Reactions: looked up via `messagePanelIndex` by messageId + emoji name

## GatewayIntents added
`GuildMessageReactions` — required for reaction panels. Also added `Partials.Reaction` and `Partials.User` to handle cached/partial reactions.

## Timed roles
`store/timedRoles.ts` — lazy per-guild cache. `startTimedRoleExpiry(client)` starts a 1-minute interval at bot login. Expiry removes the role from the member and purges the entry from DB.

## Bot command
`c!rp list` — lists all panels with their short ID.
`c!rp post <id-prefix>` — posts/reposts a panel to its configured channel. Requires Manage Roles.

## Builder
`bot/rolePanel/builder.ts` — shared between `app.ts` (internal endpoint) and `events/rolePanelInteractions.ts`. Contains `buildPanelEmbed()` and `buildPanelComponents()`.
