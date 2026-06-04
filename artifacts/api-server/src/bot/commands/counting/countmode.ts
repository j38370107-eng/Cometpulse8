import type { Command } from "../types";
import { PermissionFlagsBits } from "discord.js";
import { setCountingConfig, CountingMode } from "../../store/counting";
import { getPrefix } from "../../store/prefixes";

const MODES: CountingMode[] = ["normal", "math", "roman", "binary", "hex", "letters"];

const MODE_DESCRIPTIONS: Record<CountingMode, string> = {
  normal:  "Standard numbers (1 2 3...)",
  math:    "Math expressions that equal the next number (e.g. 2+1 for 3)",
  roman:   "Roman numerals (I II III IV...)",
  binary:  "Binary numbers (1 10 11 100...)",
  hex:     "Hexadecimal (1 2 ... 9 A B...)",
  letters: "Alphabetical (A B C ... Z AA AB...)",
};

export const countmodeCommand: Command = {
  name: "countmode",
  aliases: ["setcountmode", "countingmode"],
  description: "Set the counting mode.",
  usage: "<normal|math|roman|binary|hex|letters>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(message, args) {
    if (!message.guild) return;
    const prefix = getPrefix(message.guild.id);
    const mode = args[0]?.toLowerCase() as CountingMode;

    if (!mode || !MODES.includes(mode)) {
      const list = MODES.map((m) => `\`${m}\` — ${MODE_DESCRIPTIONS[m]}`).join("\n");
      return message.reply(`❌ Invalid mode. Available modes:\n${list}\n\nUsage: \`${prefix}countmode <mode>\``);
    }

    await setCountingConfig(message.guild.id, { mode });
    return message.reply(`✅ Counting mode set to **${mode}** — ${MODE_DESCRIPTIONS[mode]}`);
  },
};
