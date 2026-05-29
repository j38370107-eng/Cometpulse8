import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import { logger } from "../lib/logger";
import { loadCommands } from "./commands";
import { registerEvents } from "./events";
import { initAllStores } from "./store";

export async function startBot(): Promise<Client | null> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — bot will not start");
    return null;
  }

  await initAllStores();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.GuildMember,
    ],
    allowedMentions: { repliedUser: false },
  });

  (client as any).commands = new Collection();
  loadCommands(client);
  registerEvents(client);

  await client.login(token);
  logger.info("Discord bot logged in");

  return client;
}
