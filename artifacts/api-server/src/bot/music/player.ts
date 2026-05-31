import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { Player, Track } from "lavalink-client";

export type { Player, Track };
export { getLavalink, initLavalink } from "./lavalinkManager";

export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "LIVE";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function buildNowPlayingEmbed(track: Track, player: Player): EmbedBuilder {
  const loopIcon = player.repeatMode === "track" ? "🔂" : player.repeatMode === "queue" ? "🔁" : "";
  const requester = (track.requester as any);
  return new EmbedBuilder()
    .setColor(0x1DB954)
    .setTitle("🎵 Now Playing")
    .setDescription(`**[${track.info.title}](${track.info.uri})**`)
    .setThumbnail(track.info.artworkUrl || null)
    .addFields(
      { name: "Duration", value: formatDuration(track.info.duration), inline: true },
      { name: "Requested by", value: requester ? `<@${requester.id}>` : "Unknown", inline: true },
      { name: "Volume", value: `${player.volume}%`, inline: true },
      { name: "Queue", value: `${player.queue.tracks.length} song(s) up next`, inline: true },
      { name: "Loop", value: loopIcon || "Off", inline: true },
    );
}

export function buildPlayerButtons(player: Player): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music_pause").setEmoji("⏸️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_skip").setEmoji("⏭️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_stop").setEmoji("⏹️").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_loop").setEmoji("🔁").setStyle(player.repeatMode !== "off" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_queue").setEmoji("📜").setStyle(ButtonStyle.Primary),
  );
}
