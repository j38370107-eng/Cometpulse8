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
import { gstartCommand } from "./giveaway/start";
import { gendCommand } from "./giveaway/end";
import { grerollCommand } from "./giveaway/reroll";
import { glistCommand } from "./giveaway/list";
import { gcancelCommand } from "./giveaway/cancel";
import { gbonusCommand } from "./giveaway/bonus";
import { invitesCommand, whoinvitedCommand } from "./invites/invites";
import { inviteLeaderboardCommand } from "./invites/leaderboard";
import { rpCommand } from "./rolepanel/manage";
import { starboardCommand } from "./starboard/starboard";
import { suggestCommand } from "./suggestions/suggest";
import {
  approveCommand, denyCommand, implementCommand, duplicateCommand, deleteSuggestionCommand,
  suggestionsConfigCommand, viewSuggestionCommand, suggestionsLeaderboardCommand,
} from "./suggestions/reviewSuggestion";
import { embedCommand } from "./embed/embed";
import { countsetCommand, countdisableCommand } from "./counting/countset";
import { countmodeCommand } from "./counting/countmode";
import { countconfigCommand } from "./counting/countconfig";
import { countstatsCommand } from "./counting/countstats";
import { countleaderboardCommand } from "./counting/countleaderboard";
import { setcountCommand, resetcountCommand } from "./counting/countadmin";

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
  gstartCommand,
  gendCommand,
  grerollCommand,
  glistCommand,
  gcancelCommand,
  gbonusCommand,
  invitesCommand,
  whoinvitedCommand,
  inviteLeaderboardCommand,
  rpCommand,
  starboardCommand,
  suggestCommand,
  suggestionsConfigCommand,
  viewSuggestionCommand,
  suggestionsLeaderboardCommand,
  approveCommand,
  denyCommand,
  implementCommand,
  duplicateCommand,
  deleteSuggestionCommand,
  embedCommand,
  countsetCommand,
  countdisableCommand,
  countmodeCommand,
  countconfigCommand,
  countstatsCommand,
  countleaderboardCommand,
  setcountCommand,
  resetcountCommand,
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
