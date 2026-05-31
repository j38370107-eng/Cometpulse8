import { LavalinkManager } from "lavalink-client";
import type { Client } from "discord.js";
import { logger } from "../../lib/logger";

const LAVALINK_HOST = process.env.LAVALINK_HOST ?? "localhost";
const LAVALINK_PORT = parseInt(process.env.LAVALINK_PORT ?? "2333", 10);
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD ?? "youshallnotpass";
const LAVALINK_SECURE = process.env.LAVALINK_SECURE === "true";

let _manager: LavalinkManager | null = null;

export function getLavalink(): LavalinkManager {
  if (!_manager) throw new Error("LavalinkManager not initialized. Bot may still be starting up.");
  return _manager;
}

export async function initLavalink(client: Client): Promise<void> {
  _manager = new LavalinkManager({
    nodes: [
      {
        authorization: LAVALINK_PASSWORD,
        host: LAVALINK_HOST,
        port: LAVALINK_PORT,
        secure: LAVALINK_SECURE,
        id: "main",
        retryAmount: 10,
        retryDelay: 5_000,
      },
    ],
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    client: {
      id: client.user!.id,
      username: client.user!.username,
    },
    playerOptions: {
      defaultSearchPlatform: "ytsearch",
      onEmptyQueue: {
        destroyAfterMs: 30_000,
      },
    },
    autoSkip: true,
  });

  _manager.on("nodeConnect", (node) => {
    logger.info({ nodeId: node.id }, "Lavalink node connected");
  });

  _manager.on("nodeDisconnect", (node, _reason) => {
    logger.warn({ nodeId: node.id }, "Lavalink node disconnected");
  });

  _manager.on("nodeError", (node, err) => {
    logger.warn({ nodeId: node.id, err: (err as any)?.message }, "Lavalink node error");
  });

  _manager.on("trackError", (player, track, _payload) => {
    logger.warn({ guild: player.guildId, track: track.info.title }, "Lavalink track error");
  });

  await _manager.init({ id: client.user!.id, username: client.user!.username });
}
