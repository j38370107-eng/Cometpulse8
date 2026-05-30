import { Client, Message, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { logger } from "../../lib/logger";
import { memberHasModRole } from "../store/modroles";
import {
  createGiveaway,
  getGiveaway,
  getGiveawayByMessage,
  getActiveGiveaways,
  getGiveaways,
  updateGiveaway,
  giveManualBonus,
  GiveawayType,
} from "../store/giveaways";
import {
  parseDuration,
  buildGiveawayEmbed,
  buildEnterButton,
  endGiveaway,
  scheduleGiveaway,
  cancelTimer,
  pickWinners,
} from "../lib/giveawayManager";

const GIVEAWAY_PREFIX = "g!";
const DAY_MS = 86_400_000;

function isManager(message: Message): boolean {
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has("ManageGuild")) return true;
  if (member.permissions.has("Administrator")) return true;
  return memberHasModRole(message.guildId!, member.id);
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      flags[key] = val;
      if (val !== "true") i++;
    }
  }
  return flags;
}

function resolveRoleId(raw: string): string {
  const match = raw.match(/^<@&(\d+)>$/) ?? raw.match(/^(\d+)$/);
  return match ? match[1] : raw;
}

// g!start <duration> <winners> <prize> [flags]
async function handleStart(message: Message, args: string[]): Promise<void> {
  if (!isManager(message)) {
    return message.reply("❌ You need Manage Server or a mod role to start giveaways.").then(() => {});
  }

  if (args.length < 3) {
    return message.reply(
      "**Usage:** `g!start <duration> <winners> <prize> [--level N] [--role @Role] [--blrole @Role] [--type normal|role-locked|level-gated|partner] [--partner ServerName] [--age N] [--serverage N] [--booster] [--boosterbonus N] [--bonusrole @Role N] [--desc Description]`\n" +
      "**Example:** `g!start 1h 1 Nitro Classic`\n" +
      "**Example:** `g!start 24h 3 Discord Nitro --level 5 --role @Member --booster --boosterbonus 2`"
    ).then(() => {});
  }

  const durationStr = args[0];
  const ms = parseDuration(durationStr);
  if (!ms || ms < 10_000) {
    return message.reply("❌ Invalid duration. Use formats like `1h`, `30m`, `1d`, `1h30m`. Minimum 10 seconds.").then(() => {});
  }
  if (ms > 30 * DAY_MS) {
    return message.reply("❌ Maximum giveaway duration is 30 days.").then(() => {});
  }

  const winnerCount = parseInt(args[1], 10);
  if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 20) {
    return message.reply("❌ Winner count must be between 1 and 20.").then(() => {});
  }

  const flagIdx = args.findIndex(a => a.startsWith("--"), 2);
  const prizeEnd = flagIdx === -1 ? args.length : flagIdx;
  const prize = args.slice(2, prizeEnd).join(" ").trim();
  if (!prize) {
    return message.reply("❌ Prize is required.").then(() => {});
  }

  const flags = parseFlags(args.slice(flagIdx === -1 ? args.length : flagIdx));

  const type: GiveawayType = (["normal", "role-locked", "level-gated", "partner"].includes(flags.type)
    ? flags.type
    : "normal") as GiveawayType;

  const requiredRoles: string[] = flags.role ? [resolveRoleId(flags.role)] : [];
  const blacklistRoles: string[] = flags.blrole ? [resolveRoleId(flags.blrole)] : [];
  const minLevel = flags.level ? Math.max(0, parseInt(flags.level, 10) || 0) : 0;
  const minAccountAgeDays = flags.age ? Math.max(0, parseInt(flags.age, 10) || 0) : 0;
  const minServerAgeDays = flags.serverage ? Math.max(0, parseInt(flags.serverage, 10) || 0) : 0;
  const partnerServer = flags.partner ?? "";
  const description = flags.desc ?? "";
  const boosterEnabled = "booster" in flags;
  const boosterBonus = flags.boosterbonus ? Math.max(1, parseInt(flags.boosterbonus, 10) || 1) : 1;

  const roleMultipliers: Array<{ roleId: string; bonus: number }> = [];
  if (flags.bonusrole) {
    const parts = flags.bonusrole.split(" ");
    const bonusRoleId = resolveRoleId(parts[0]);
    const bonusAmt = parseInt(parts[1] ?? "1", 10) || 1;
    roleMultipliers.push({ roleId: bonusRoleId, bonus: bonusAmt });
  }

  const endsAt = Date.now() + ms;
  const guildId = message.guildId!;
  const channelId = message.channelId;
  const hostId = message.author.id;

  const placeholderEmbed = new EmbedBuilder()
    .setColor(0xf0a500)
    .setTitle(`🎉 GIVEAWAY — ${prize}`)
    .setDescription("Setting up giveaway...");

  const gMsg = await (message.channel as TextChannel).send({
    embeds: [placeholderEmbed],
    components: [buildEnterButton("placeholder", 0)],
  });

  try {
    const giveaway = await createGiveaway({
      guildId,
      channelId,
      messageId: gMsg.id,
      hostId,
      prize,
      description,
      winnerCount,
      endsAt,
      type,
      partnerServer,
      requirements: {
        requiredRoles,
        blacklistRoles,
        minAccountAgeDays,
        minServerAgeDays,
        minLevel,
        minMessages: 0,
      },
      bonus: {
        roleMultipliers,
        levelBonuses: [],
        boosterBonus,
        boosterEnabled,
      },
    });

    await gMsg.edit({
      embeds: [buildGiveawayEmbed(giveaway)],
      components: [buildEnterButton(giveaway.id, 0)],
    });

    scheduleGiveaway(message.client, giveaway);

    await message.delete().catch(() => {});
    logger.info({ giveawayId: giveaway.id, prize, guildId }, "Giveaway started");
  } catch (err) {
    logger.error({ err }, "Failed to create giveaway");
    await gMsg.delete().catch(() => {});
    await message.reply("❌ Failed to create giveaway.").catch(() => {});
  }
}

// g!end <messageId|giveawayId>
async function handleEnd(message: Message, args: string[]): Promise<void> {
  if (!isManager(message)) {
    return message.reply("❌ You need Manage Server or a mod role to end giveaways.").then(() => {});
  }
  if (!args[0]) {
    return message.reply("**Usage:** `g!end <messageId|giveawayId>`").then(() => {});
  }

  const guildId = message.guildId!;
  const id = args[0].trim();
  const giveaway = getGiveaway(guildId, id) ?? getGiveawayByMessage(id);

  if (!giveaway || giveaway.guildId !== guildId) {
    return message.reply("❌ Giveaway not found.").then(() => {});
  }
  if (giveaway.ended) {
    return message.reply("❌ This giveaway has already ended.").then(() => {});
  }
  if (giveaway.cancelled) {
    return message.reply("❌ This giveaway was cancelled.").then(() => {});
  }

  cancelTimer(giveaway.id);
  await endGiveaway(message.client, giveaway);
  await message.reply("✅ Giveaway ended.").then(() => {});
}

// g!reroll <messageId|giveawayId> [winnerCount]
async function handleReroll(message: Message, args: string[]): Promise<void> {
  if (!isManager(message)) {
    return message.reply("❌ You need Manage Server or a mod role to reroll giveaways.").then(() => {});
  }
  if (!args[0]) {
    return message.reply("**Usage:** `g!reroll <messageId|giveawayId> [winnerCount]`").then(() => {});
  }

  const guildId = message.guildId!;
  const id = args[0].trim();
  const giveaway = getGiveaway(guildId, id) ?? getGiveawayByMessage(id);

  if (!giveaway || giveaway.guildId !== guildId) {
    return message.reply("❌ Giveaway not found.").then(() => {});
  }
  if (!giveaway.ended) {
    return message.reply("❌ This giveaway hasn't ended yet. Use `g!end` first.").then(() => {});
  }

  const count = args[1] ? Math.min(20, Math.max(1, parseInt(args[1], 10) || 1)) : giveaway.winnerCount;
  const newWinners = pickWinners(giveaway, count);

  if (newWinners.length === 0) {
    return message.reply("❌ No entries to pick winners from.").then(() => {});
  }

  await updateGiveaway(guildId, giveaway.id, { winners: newWinners });

  const winnersStr = newWinners.map(w => `<@${w}>`).join(", ");
  await (message.channel as TextChannel).send({
    content: `🎊 **Giveaway Reroll** — New winner(s) for **${giveaway.prize}**: ${winnersStr}!`,
  });

  // DM new winners
  for (const wId of newWinners) {
    try {
      const user = await message.client.users.fetch(wId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf0a500)
            .setTitle("🎉 You won a giveaway reroll!")
            .setDescription(`You won **${giveaway.prize}**!\n\nContact the host to claim your prize.`)
            .setTimestamp(),
        ],
      });
    } catch { /* DMs closed */ }
  }

  await message.delete().catch(() => {});
}

// g!list
async function handleList(message: Message): Promise<void> {
  const guildId = message.guildId!;
  const active = getActiveGiveaways(guildId);

  if (active.length === 0) {
    return message.reply("📋 No active giveaways.").then(() => {});
  }

  const embed = new EmbedBuilder()
    .setColor(0xf0a500)
    .setTitle("🎉 Active Giveaways")
    .setTimestamp();

  for (const g of active.slice(0, 10)) {
    const remaining = Math.max(0, g.endsAt - Date.now());
    const mins = Math.floor(remaining / 60_000);
    const hours = Math.floor(mins / 60);
    const timeStr = hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
    embed.addFields({
      name: `🎁 ${g.prize}`,
      value: `Entries: **${g.entries.length}** | Winners: **${g.winnerCount}** | Ends in: **${timeStr}**\nID: \`${g.id}\``,
      inline: false,
    });
  }

  await message.reply({ embeds: [embed] }).then(() => {});
}

// g!cancel <messageId|giveawayId>
async function handleCancel(message: Message, args: string[]): Promise<void> {
  if (!isManager(message)) {
    return message.reply("❌ You need Manage Server or a mod role to cancel giveaways.").then(() => {});
  }
  if (!args[0]) {
    return message.reply("**Usage:** `g!cancel <messageId|giveawayId>`").then(() => {});
  }

  const guildId = message.guildId!;
  const id = args[0].trim();
  const giveaway = getGiveaway(guildId, id) ?? getGiveawayByMessage(id);

  if (!giveaway || giveaway.guildId !== guildId) {
    return message.reply("❌ Giveaway not found.").then(() => {});
  }
  if (giveaway.ended || giveaway.cancelled) {
    return message.reply("❌ This giveaway is already over.").then(() => {});
  }

  cancelTimer(giveaway.id);
  await updateGiveaway(guildId, giveaway.id, { cancelled: true });

  try {
    const channel = await message.client.channels.fetch(giveaway.channelId) as TextChannel | null;
    if (channel) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) {
        const cancelledEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`❌ GIVEAWAY CANCELLED — ${giveaway.prize}`)
          .setDescription("This giveaway has been cancelled by a moderator.")
          .setTimestamp();
        await msg.edit({
          embeds: [cancelledEmbed],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`giveaway:enter:${giveaway.id}`)
                .setLabel("Giveaway Cancelled")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
            ),
          ],
        });
      }
    }
  } catch { /* ignore */ }

  await message.reply(`✅ Giveaway for **${giveaway.prize}** has been cancelled.`).then(() => {});
}

// g!bonus <@user> <amount> [messageId|giveawayId]
async function handleBonus(message: Message, args: string[]): Promise<void> {
  if (!isManager(message)) {
    return message.reply("❌ You need Manage Server or a mod role to give bonus entries.").then(() => {});
  }
  if (args.length < 2) {
    return message.reply("**Usage:** `g!bonus <@user> <amount> [giveawayId]`").then(() => {});
  }

  const guildId = message.guildId!;
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply("❌ Please mention a user.").then(() => {});
  }

  const amount = parseInt(args[1], 10);
  if (isNaN(amount) || amount === 0) {
    return message.reply("❌ Invalid bonus amount.").then(() => {});
  }

  let giveaway = args[2]
    ? (getGiveaway(guildId, args[2]) ?? getGiveawayByMessage(args[2]))
    : null;

  if (!giveaway) {
    const active = getActiveGiveaways(guildId);
    if (active.length === 1) {
      giveaway = active[0];
    } else if (active.length === 0) {
      return message.reply("❌ No active giveaways.").then(() => {});
    } else {
      return message.reply("❌ Multiple active giveaways — specify the ID: `g!bonus @user amount giveawayId`").then(() => {});
    }
  }

  if (giveaway.guildId !== guildId) {
    return message.reply("❌ Giveaway not found.").then(() => {});
  }
  if (giveaway.ended || giveaway.cancelled) {
    return message.reply("❌ That giveaway has ended.").then(() => {});
  }

  const success = await giveManualBonus(guildId, giveaway.id, targetUser.id, amount);
  if (!success) {
    return message.reply("❌ That user has not entered the giveaway.").then(() => {});
  }

  await message.reply(
    `✅ Gave **${amount > 0 ? "+" : ""}${amount}** bonus ${Math.abs(amount) === 1 ? "entry" : "entries"} to <@${targetUser.id}> in the **${giveaway.prize}** giveaway.`
  ).then(() => {});
}

// ── Registration ──────────────────────────────────────────────────────────────
export function registerGiveawayCommands(client: Client): void {
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.toLowerCase().startsWith(GIVEAWAY_PREFIX)) return;

    const content = message.content.slice(GIVEAWAY_PREFIX.length).trim();
    const parts = content.split(/\s+/);
    const subcommand = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    try {
      switch (subcommand) {
        case "start": await handleStart(message, args); break;
        case "end": await handleEnd(message, args); break;
        case "reroll": await handleReroll(message, args); break;
        case "list": await handleList(message); break;
        case "cancel": await handleCancel(message, args); break;
        case "bonus": await handleBonus(message, args); break;
        case "help":
          await message.reply(
            "**🎉 Giveaway Commands** (prefix: `g!`)\n\n" +
            "`g!start <duration> <winners> <prize>` — Start a giveaway\n" +
            "`g!end <id>` — Force end a giveaway early\n" +
            "`g!reroll <id> [count]` — Pick new winner(s)\n" +
            "`g!list` — Show active giveaways\n" +
            "`g!cancel <id>` — Cancel a giveaway\n" +
            "`g!bonus <@user> <amount> [id]` — Give bonus entries\n\n" +
            "**Start flags:**\n" +
            "`--level N` `--role @Role` `--blrole @Role` `--type <normal|role-locked|level-gated|partner>`\n" +
            "`--age N` `--serverage N` `--booster` `--boosterbonus N` `--bonusrole @Role N` `--partner ServerName` `--desc Text`"
          );
          break;
        default:
          break;
      }
    } catch (err) {
      logger.error({ err, subcommand }, "Giveaway command failed");
      await message.reply("❌ An error occurred running that giveaway command.").catch(() => {});
    }
  });
}
