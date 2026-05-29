import { Client, Collection } from "discord.js";
import type { Command } from "./types";
import { changePrefixCommand } from "./changeprefix";
import { helpCommand } from "./help";
import { rankCommand } from "./leveling/rank";
import { leaderboardCommand } from "./leveling/leaderboard";
import { setXpCommand } from "./leveling/setxp";
import { resetXpCommand } from "./leveling/resetxp";
import { giveXpCommand } from "./leveling/givexp";
import { setLevelCommand } from "./leveling/setlevel";
import { levelConfigCommand } from "./leveling/levelconfig";
import { xpExportCommand, xpImportCommand } from "./leveling/xpexport";

export const commands: Command[] = [
  helpCommand,
  changePrefixCommand,
  rankCommand,
  leaderboardCommand,
  setXpCommand,
  resetXpCommand,
  giveXpCommand,
  setLevelCommand,
  levelConfigCommand,
  xpExportCommand,
  xpImportCommand,
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
