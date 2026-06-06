import { Client, Message, TextChannel, EmbedBuilder } from "discord.js";
import { logger } from "../../lib/logger";
import {
  getBumpReminderConfig,
  getBumpReminderState,
  setBumpReminderState,
} from "../store/bumpReminder";

// Disboard's bot user ID — never changes
const DISBOARD_ID = "302050872383242240";

// Per-guild reminder timers so we can clear/reschedule them
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(guildId: string): void {
  const t = timers.get(guildId);
  if (t) { clearTimeout(t); timers.delete(guildId); }
}

async function sendReminder(client: Client, guildId: string): Promise<void> {
  timers.delete(guildId);
  const config = getBumpReminderConfig(guildId);
  if (!config.enabled || !config.channelId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!channel?.isTextBased()) return;

  const content = config.roleId ? `<@&${config.roleId}>` : undefined;

  const embed = new EmbedBuilder()
    .setColor(0x7c3cfa)
    .setTitle("🚀 Bump Reminder")
    .setDescription(config.reminderMessage)
    .setFooter({ text: "Use /bump on Disboard to keep the server visible!" })
    .setTimestamp();

  try {
    const msg = await channel.send({
      content,
      embeds: [embed],
      allowedMentions: { roles: config.roleId ? [config.roleId] : [] },
    });
    await setBumpReminderState(guildId, { reminderMessageId: msg.id });
    logger.info({ guildId }, "Bump reminder sent");
  } catch (err) {
    logger.error({ err, guildId }, "Failed to send bump reminder");
  }
}

function scheduleReminder(client: Client, guildId: string, delayMs: number): void {
  clearTimer(guildId);
  const t = setTimeout(() => sendReminder(client, guildId), delayMs);
  timers.set(guildId, t);
}

export function registerBumpReminderEvents(client: Client): void {
  // On ready, reschedule any reminders that are still pending from before a restart
  client.once("ready", () => {
    for (const guild of client.guilds.cache.values()) {
      const config = getBumpReminderConfig(guild.id);
      if (!config.enabled) continue;
      const state = getBumpReminderState(guild.id);
      if (!state.lastBumpedAt) continue;

      const elapsed = Date.now() - state.lastBumpedAt;
      const BUMP_COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours
      const remaining = BUMP_COOLDOWN - elapsed;

      if (remaining > 0) {
        logger.info({ guildId: guild.id, remainingMs: remaining }, "Rescheduling bump reminder after restart");
        scheduleReminder(client, guild.id, remaining);
      } else {
        // Reminder is already overdue — send immediately
        sendReminder(client, guild.id);
      }
    }
  });

  client.on("messageCreate", async (message: Message) => {
    // Only process embeds from Disboard
    if (message.author.id !== DISBOARD_ID) return;
    if (!message.guild) return;
    if (!message.embeds.length) return;

    const guildId = message.guild.id;
    const config = getBumpReminderConfig(guildId);
    if (!config.enabled) return;

    // Disboard's success embed description contains "Bump done!"
    const isBump = message.embeds.some((e) =>
      e.description?.toLowerCase().includes("bump done") ||
      e.description?.toLowerCase().includes("bump") ||
      e.title?.toLowerCase().includes("bump")
    );
    if (!isBump) return;

    // Figure out who bumped — the message doesn't always have the user, so we
    // try the interaction user first, then fall back to "someone".
    const bumperId = (message.interaction as any)?.user?.id ?? null;

    await setBumpReminderState(guildId, {
      lastBumpedAt: Date.now(),
      lastBumpedBy: bumperId,
      reminderMessageId: null,
    });

    // Optionally delete a previous "time to bump" reminder message
    if (config.autoDelete && config.channelId) {
      const prev = getBumpReminderState(guildId).reminderMessageId;
      if (prev) {
        const ch = message.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
        ch?.messages.fetch(prev).then((m) => m.delete()).catch(() => {});
      }
    }

    // Send a bump acknowledgement in the configured channel
    if (config.channelId) {
      const ch = message.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
      if (ch?.isTextBased()) {
        const bumperText = bumperId ? `<@${bumperId}>` : "Someone";
        await ch.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setDescription(`✅ ${bumperText} bumped the server! Next reminder in **2 hours**.`)
              .setTimestamp(),
          ],
        }).catch(() => {});
      }
    }

    logger.info({ guildId, bumperId }, "Disboard bump detected — scheduling 2h reminder");
    scheduleReminder(client, guildId, 2 * 60 * 60 * 1000);
  });
}
