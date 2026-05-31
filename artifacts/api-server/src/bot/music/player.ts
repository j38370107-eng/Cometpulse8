import {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  getVoiceConnection, AudioPlayer, VoiceConnection,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import { GuildMember, Message, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, VoiceChannel, StageChannel } from "discord.js";
import playdl from "play-dl";
import { getMusicConfig } from "../store/musicConfig";
import { logger } from "../../lib/logger";

export interface Track {
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  requesterId: string;
  source: string;
}

export interface GuildQueue {
  tracks: Track[];
  current: Track | null;
  player: AudioPlayer;
  volume: number;
  loop: "none" | "track" | "queue";
  textChannelId: string;
  voiceChannelId: string;
  lastNpMessageId?: string;
  history: Track[];
  playing: boolean;
}

const queues = new Map<string, GuildQueue>();
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function getQueue(guildId: string): GuildQueue | null {
  return queues.get(guildId) ?? null;
}

export function destroyQueue(guildId: string) {
  const q = queues.get(guildId);
  if (q) {
    q.player.stop(true);
    queues.delete(guildId);
  }
  const conn = getVoiceConnection(guildId);
  if (conn) conn.destroy();
  clearDisconnectTimer(guildId);
}

function clearDisconnectTimer(guildId: string) {
  const t = disconnectTimers.get(guildId);
  if (t) { clearTimeout(t); disconnectTimers.delete(guildId); }
}

function setDisconnectTimer(guildId: string, ms: number, cb: () => void) {
  clearDisconnectTimer(guildId);
  disconnectTimers.set(guildId, setTimeout(cb, ms));
}

async function playNext(guildId: string, client: any): Promise<void> {
  const q = queues.get(guildId);
  if (!q) return;

  if (q.tracks.length === 0) {
    q.current = null;
    q.playing = false;
    const cfg = await getMusicConfig(guildId);
    setDisconnectTimer(guildId, cfg.autoDisconnectMs, () => destroyQueue(guildId));
    return;
  }

  const track = q.loop === "queue"
    ? q.tracks[0]
    : q.tracks.shift()!;

  if (q.loop === "none" || q.loop === "track") {
    if (q.loop === "none") {
      q.history.push(track);
    }
  }

  q.current = track;
  q.playing = true;

  try {
    let stream;

    if (track.source === "youtube" || track.url.includes("youtube") || track.url.includes("youtu.be")) {
      const info = await playdl.stream(track.url, { quality: 2 });
      stream = info.stream;
    } else if (track.source === "soundcloud") {
      const info = await playdl.stream(track.url);
      stream = info.stream;
    } else {
      const info = await playdl.stream(track.url, { quality: 2 });
      stream = info.stream;
    }

    const resource = createAudioResource(stream, {
      inlineVolume: true,
    });
    resource.volume?.setVolume(q.volume / 100);
    q.player.play(resource);
    clearDisconnectTimer(guildId);

    const cfg = await getMusicConfig(guildId);
    if (cfg.announceNowPlaying && q.textChannelId) {
      const guild = client.guilds.cache.get(guildId);
      const ch = guild?.channels.cache.get(q.textChannelId) as TextChannel | null;
      if (ch) {
        const embed = buildNowPlayingEmbed(track, q);
        const msg = await ch.send({ embeds: [embed], components: [buildPlayerButtons(q)] }).catch(() => null);
        if (msg && q.lastNpMessageId) {
          ch.messages.fetch(q.lastNpMessageId).then(old => old.delete()).catch(() => {});
        }
        if (msg) q.lastNpMessageId = msg.id;
      }
    }
  } catch (err) {
    logger.warn({ err, track: track.title }, "Music playback error");
    q.current = null;
    q.playing = false;
    setTimeout(() => playNext(guildId, client), 500);
  }
}

export async function joinAndPlay(
  member: GuildMember,
  track: Track,
  message: Message,
  client: any,
): Promise<{ queued: boolean; position: number }> {
  const guildId = member.guild.id;
  const vc = member.voice.channel as VoiceChannel | StageChannel | null;
  if (!vc) throw new Error("You must be in a voice channel.");

  const cfg = await getMusicConfig(guildId);
  let q = queues.get(guildId);

  if (!q) {
    const conn = joinVoiceChannel({
      channelId: vc.id,
      guildId,
      adapterCreator: member.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    conn.subscribe(player);

    q = {
      tracks: [],
      current: null,
      player,
      volume: cfg.defaultVolume,
      loop: "none",
      textChannelId: message.channelId,
      voiceChannelId: vc.id,
      history: [],
      playing: false,
    };
    queues.set(guildId, q);

    player.on(AudioPlayerStatus.Idle, () => {
      const currentQ = queues.get(guildId);
      if (!currentQ) return;
      if (currentQ.loop === "track" && currentQ.current) {
        currentQ.tracks.unshift(currentQ.current);
      }
      playNext(guildId, client);
    });

    player.on("error", (err) => {
      logger.warn({ err }, "Audio player error");
      playNext(guildId, client);
    });

    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await entersState(conn, VoiceConnectionStatus.Ready, 5_000);
      } catch {
        destroyQueue(guildId);
      }
    });
  } else {
    clearDisconnectTimer(guildId);
  }

  if (q.current || q.playing) {
    if (q.tracks.length >= cfg.maxQueueSize) {
      throw new Error(`Queue is full (max ${cfg.maxQueueSize} songs).`);
    }
    q.tracks.push(track);
    return { queued: true, position: q.tracks.length };
  }

  q.tracks.push(track);
  await playNext(guildId, client);
  return { queued: false, position: 0 };
}

export async function searchTrack(query: string): Promise<Track | null> {
  try {
    let url = query;
    let source = "youtube";

    if (!query.startsWith("http")) {
      const results = await playdl.search(query, { source: { youtube: "video" }, limit: 1 });
      if (!results.length) return null;
      const r = results[0];
      return {
        title: r.title ?? "Unknown",
        url: r.url,
        duration: r.durationInSec ?? 0,
        thumbnail: r.thumbnails?.[0]?.url ?? "",
        requesterId: "",
        source: "youtube",
      };
    }

    if (playdl.yt_validate(url) === "video") {
      const info = await playdl.video_info(url);
      return {
        title: info.video_details.title ?? "Unknown",
        url: info.video_details.url,
        duration: info.video_details.durationInSec ?? 0,
        thumbnail: info.video_details.thumbnails?.[0]?.url ?? "",
        requesterId: "",
        source: "youtube",
      };
    }

    if (playdl.yt_validate(url) === "playlist") {
      return null;
    }

    const results = await playdl.search(query, { source: { youtube: "video" }, limit: 1 });
    if (!results.length) return null;
    const r = results[0];
    return {
      title: r.title ?? "Unknown",
      url: r.url,
      duration: r.durationInSec ?? 0,
      thumbnail: r.thumbnails?.[0]?.url ?? "",
      requesterId: "",
      source: "youtube",
    };
  } catch (err) {
    logger.warn({ err }, "Track search error");
    return null;
  }
}

export async function searchMultiple(query: string, limit = 5): Promise<Track[]> {
  try {
    const results = await playdl.search(query, { source: { youtube: "video" }, limit });
    return results.map(r => ({
      title: r.title ?? "Unknown",
      url: r.url,
      duration: r.durationInSec ?? 0,
      thumbnail: r.thumbnails?.[0]?.url ?? "",
      requesterId: "",
      source: "youtube",
    }));
  } catch {
    return [];
  }
}

export async function loadPlaylist(url: string): Promise<Track[]> {
  try {
    const playlist = await playdl.playlist_info(url, { incomplete: true });
    if (!playlist?.videos) return [];
    return playlist.videos.map(v => ({
      title: v.title ?? "Unknown",
      url: v.url,
      duration: v.durationInSec ?? 0,
      thumbnail: v.thumbnails?.[0]?.url ?? "",
      requesterId: "",
      source: "youtube",
    }));
  } catch {
    return [];
  }
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "LIVE";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildNowPlayingEmbed(track: Track, q: GuildQueue): EmbedBuilder {
  const loopIcon = q.loop === "track" ? "🔂" : q.loop === "queue" ? "🔁" : "";
  return new EmbedBuilder()
    .setColor(0x1DB954)
    .setTitle("🎵 Now Playing")
    .setDescription(`**[${track.title}](${track.url})**`)
    .setThumbnail(track.thumbnail || null)
    .addFields(
      { name: "Duration", value: formatDuration(track.duration), inline: true },
      { name: "Requested by", value: `<@${track.requesterId}>`, inline: true },
      { name: "Volume", value: `${q.volume}%`, inline: true },
      { name: "Queue", value: `${q.tracks.length} song(s) up next`, inline: true },
      { name: "Loop", value: loopIcon || "Off", inline: true },
    );
}

export function buildPlayerButtons(q: GuildQueue): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music_pause").setEmoji("⏸️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_skip").setEmoji("⏭️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_stop").setEmoji("⏹️").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_loop").setEmoji("🔁").setStyle(q.loop !== "none" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_queue").setEmoji("📜").setStyle(ButtonStyle.Primary),
  );
}

export { playNext };
