import { Client, Collection } from "discord.js";
import type { Command } from "./types";
import { changePrefixCommand } from "./changeprefix";
import { helpCommand } from "./help";

export const commands: Command[] = [
  helpCommand,
  changePrefixCommand,
];

export function loadCommands(client: Client) {
  const collection: Collection<string, Command> = new Collection();
  for (const cmd of commands) {
    collection.set(cmd.name, cmd);
    for (const alias of cmd.aliases) {
      collection.set(alias, cmd);
    }
  }
  (client as any).commands = collection;
}
