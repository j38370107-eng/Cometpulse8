import { Message, EmbedBuilder, PermissionFlagsBits, GuildMember, TextChannel } from "discord.js";
import type { Command } from "../types";
import {
  getQueue, joinAndPlay, searchTrack, searchMultiple, loadPlaylist,
  destroyQueue, buildNowPlayingEmbed, buildPlayerButtons, formatDuration,
  Track, playNext,
} from "../../music/player";
import { getMusicConfig } from "../../store/musicConfig";

async function isDj(message: Message): Promise<boolean> {
  if (!message.guild) return false;
  if (message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const cfg = await getMusicConfig(message.guild.id);
  if (cfg.djRole && message.member?.roles.cache.has(cfg.djRole)) return true;
  return false;
}

async function requireVoice(message: Message): Promise<GuildMember | null> {
  const member = message.member as GuildMember;
  if (!member.voice.channel) {
    await message.reply("❌ You must be in a voice channel.");
    return null;
  }
  return member;
}

export const playCommand: Command = {
  name: "play",
  aliases: ["p"],
  description: "Play a song or add to queue",
  usage: "play <song name or URL>",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const member = await requireVoice(message);
    if (!member) return;

    const query = args.join(" ").trim();
    if (!query) return message.reply("❌ Provide a song name or URL.");

    const cfg = await getMusicConfig(message.guild.id);
    if (cfg.musicChannel && message.channelId !== cfg.musicChannel) {
      return message.reply(`❌ Use <#${cfg.musicChannel}> for music commands.`);
    }

    const msg = await message.reply("🔍 Searching...");

    try {
      if (query.includes("list=") || (query.startsWith("http") && query.includes("playlist"))) {
        const tracks = await loadPlaylist(query);
        if (!tracks.length) return msg.edit("❌ Could not load playlist.");
        for (const t of tracks) t.requesterId = message.author.id;
        const q = getQueue(message.guild.id);
        if (!q) {
          const first = tracks.shift()!;
          await joinAndPlay(member, first, message, message.client);
          for (const t of tracks) {
            const currentQ = getQueue(message.guild.id);
            if (currentQ) currentQ.tracks.push(t);
          }
        } else {
          for (const t of tracks) q.tracks.push(t);
        }
        return msg.edit(`✅ Added **${tracks.length + 1}** songs from playlist to queue.`);
      }

      const track = await searchTrack(query);
      if (!track) return msg.edit("❌ No results found.");
      track.requesterId = message.author.id;

      const { queued, position } = await joinAndPlay(member, track, message, message.client);

      if (queued) {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("➕ Added to Queue")
          .setDescription(`**[${track.title}](${track.url})**`)
          .setThumbnail(track.thumbnail || null)
          .addFields(
            { name: "Duration", value: formatDuration(track.duration), inline: true },
            { name: "Position", value: `#${position}`, inline: true },
          );
        return msg.edit({ content: "", embeds: [embed] });
      }

      return msg.edit({ content: "", embeds: [buildNowPlayingEmbed(track, getQueue(message.guild.id)!)] });
    } catch (err: any) {
      return msg.edit(`❌ ${err.message ?? "Playback error."}`);
    }
  },
};

export const skipCommand: Command = {
  name: "skip",
  aliases: ["s"],
  description: "Skip the current song",
  usage: "skip",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const q = getQueue(message.guild.id);
    if (!q?.current) return message.reply("❌ Nothing is playing.");
    if (!await isDj(message)) {
      const vc = (message.member as GuildMember).voice.channel;
      if (!vc) return message.reply("❌ You must be in a voice channel.");
      const members = vc.members.filter(m => !m.user.bot).size;
      const needed = Math.ceil(members * ((await getMusicConfig(message.guild.id)).voteskipPercent / 100));
      return message.reply(`🗳️ Vote skip needs ${needed} votes. (Use \`voteskip\` if non-DJ)`);
    }
    q.player.stop();
    return message.reply(`⏭️ Skipped **${q.current.title}**.`);
  },
};

export const stopCommand: Command = {
  name: "stop",
  aliases: ["disconnect", "dc"],
  description: "Stop music and clear queue",
  usage: "stop",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!await isDj(message)) return message.reply("❌ DJ role required.");
    if (!getQueue(message.guild.id)) return message.reply("❌ Nothing is playing.");
    destroyQueue(message.guild.id);
    return message.reply("⏹️ Stopped music and cleared queue.");
  },
};

export const pauseCommand: Command = {
  name: "pause",
  aliases: [],
  description: "Pause the current song",
  usage: "pause",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const q = getQueue(message.guild.id);
    if (!q?.current) return message.reply("❌ Nothing is playing.");
    q.player.pause();
    return message.reply("⏸️ Paused.");
  },
};

export const resumeCommand: Command = {
  name: "resume",
  aliases: ["unpause"],
  description: "Resume the paused song",
  usage: "resume",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const q = getQueue(message.guild.id);
    if (!q) return message.reply("❌ Nothing is paused.");
    q.player.unpause();
    return message.reply("▶️ Resumed.");
  },
};

export const queueCommand: Command = {
  name: "queue",
  aliases: ["q"],
  description: "View the current queue",
  usage: "queue [page]",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const q = getQueue(message.guild.id);
    if (!q || (!q.current && q.tracks.length === 0)) return message.reply("📭 Queue is empty.");

    const page = Math.max(1, parseInt(args[0], 10) || 1);
    const perPage = 10;
    const start = (page - 1) * perPage;
    const total = q.tracks.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    const embed = new EmbedBuilder()
      .setTitle("📜 Queue")
      .setColor(0x5865F2);

    if (q.current) {
      embed.addFields({ name: "🎵 Now Playing", value: `[${q.current.title}](${q.current.url}) — ${formatDuration(q.current.duration)}` });
    }

    const slice = q.tracks.slice(start, start + perPage);
    if (slice.length > 0) {
      embed.addFields({
        name: `Up Next (${total} total)`,
        value: slice.map((t, i) =>
          `**${start + i + 1}.** [${t.title}](${t.url}) — ${formatDuration(t.duration)} — <@${t.requesterId}>`
        ).join("\n"),
      });
    }

    embed.setFooter({ text: `Page ${page}/${totalPages} • Loop: ${q.loop} • Volume: ${q.volume}%` });
    return message.reply({ embeds: [embed] });
  },
};

export const nowPlayingCommand: Command = {
  name: "nowplaying",
  aliases: ["np"],
  description: "Show what's currently playing",
  usage: "nowplaying",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const q = getQueue(message.guild.id);
    if (!q?.current) return message.reply("❌ Nothing is playing.");
    return message.reply({ embeds: [buildNowPlayingEmbed(q.current, q)], components: [buildPlayerButtons(q)] });
  },
};

export const volumeCommand: Command = {
  name: "volume",
  aliases: ["vol"],
  description: "Set the volume (0-100)",
  usage: "volume <0-100>",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!await isDj(message)) return message.reply("❌ DJ role required.");
    const q = getQueue(message.guild.id);
    if (!q) return message.reply("❌ Nothing is playing.");
    const vol = parseInt(args[0], 10);
    if (isNaN(vol) || vol < 0 || vol > 100) return message.reply("❌ Volume must be 0–100.");
    q.volume = vol;
    return message.reply(`🔊 Volume set to **${vol}%**.`);
  },
};

export const loopCommand: Command = {
  name: "loop",
  aliases: ["repeat"],
  description: "Toggle loop mode (none/track/queue)",
  usage: "loop [track|queue|off]",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const q = getQueue(message.guild.id);
    if (!q) return message.reply("❌ Nothing is playing.");
    const mode = args[0]?.toLowerCase();
    if (mode === "track") q.loop = "track";
    else if (mode === "queue") q.loop = "queue";
    else if (mode === "off" || mode === "none") q.loop = "none";
    else {
      q.loop = q.loop === "none" ? "track" : q.loop === "track" ? "queue" : "none";
    }
    const icons = { none: "❌ Off", track: "🔂 Track", queue: "🔁 Queue" };
    return message.reply(`Loop: **${icons[q.loop]}**`);
  },
};

export const shuffleCommand: Command = {
  name: "shuffle",
  aliases: [],
  description: "Shuffle the queue",
  usage: "shuffle",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const q = getQueue(message.guild.id);
    if (!q || q.tracks.length < 2) return message.reply("❌ Not enough songs to shuffle.");
    for (let i = q.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q.tracks[i], q.tracks[j]] = [q.tracks[j], q.tracks[i]];
    }
    return message.reply(`🔀 Shuffled ${q.tracks.length} songs.`);
  },
};

export const removeCommand: Command = {
  name: "remove",
  aliases: ["rm"],
  description: "Remove a song from the queue",
  usage: "remove <position>",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const q = getQueue(message.guild.id);
    if (!q || q.tracks.length === 0) return message.reply("❌ Queue is empty.");
    const pos = parseInt(args[0], 10);
    if (isNaN(pos) || pos < 1 || pos > q.tracks.length) return message.reply("❌ Invalid position.");
    const removed = q.tracks.splice(pos - 1, 1)[0];
    return message.reply(`🗑️ Removed **${removed.title}**.`);
  },
};

export const clearQueueCommand: Command = {
  name: "clearqueue",
  aliases: ["cq"],
  description: "Clear the song queue",
  usage: "clearqueue",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!await isDj(message)) return message.reply("❌ DJ role required.");
    const q = getQueue(message.guild.id);
    if (!q) return message.reply("❌ Nothing is playing.");
    q.tracks = [];
    return message.reply("🗑️ Queue cleared.");
  },
};

export const searchCommand: Command = {
  name: "search",
  aliases: [],
  description: "Search for songs and pick one",
  usage: "search <query>",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const member = (message.member as GuildMember);
    if (!member.voice.channel) return message.reply("❌ Join a voice channel first.");

    const query = args.join(" ").trim();
    if (!query) return message.reply("❌ Provide a search query.");

    const results = await searchMultiple(query, 5);
    if (!results.length) return message.reply("❌ No results found.");

    const embed = new EmbedBuilder()
      .setTitle("🔍 Search Results")
      .setColor(0x5865F2)
      .setDescription(
        results.map((r, i) => `**${i + 1}.** [${r.title}](${r.url}) — ${formatDuration(r.duration)}`).join("\n")
      )
      .setFooter({ text: "Reply with a number (1-5) to pick, or cancel" });

    const msg = await message.reply({ embeds: [embed] });

    const filter = (m: Message) => m.author.id === message.author.id && /^[1-5]$|^cancel$/i.test(m.content);
    const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30_000 }).catch(() => null);

    if (!collected || collected.size === 0 || collected.first()!.content.toLowerCase() === "cancel") {
      return msg.edit({ content: "❌ Search cancelled.", embeds: [] });
    }

    const pick = parseInt(collected.first()!.content, 10) - 1;
    const track = results[pick];
    if (!track) return msg.edit({ content: "❌ Invalid selection.", embeds: [] });

    track.requesterId = message.author.id;
    const { queued, position } = await joinAndPlay(member, track, message, message.client);

    return msg.edit({
      content: queued ? `✅ Added **${track.title}** to queue at position #${position}.` : "",
      embeds: queued ? [] : [buildNowPlayingEmbed(track, getQueue(message.guild.id)!)],
    });
  },
};

export const musicConfigCommand: Command = {
  name: "musicconfig",
  aliases: ["mc"],
  description: "Configure the music system",
  usage: "musicconfig <djrole|channel|volume|queue|disconnect|voteskip|announce> [value]",
  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("❌ Manage Server required.");
    }

    const cfg = await getMusicConfig(message.guild.id);
    const { setMusicConfig } = await import("../../store/musicConfig");
    const sub = args[0]?.toLowerCase();

    if (!sub) {
      const embed = new EmbedBuilder()
        .setTitle("🎵 Music Configuration")
        .setColor(0x1DB954)
        .addFields(
          { name: "DJ Role", value: cfg.djRole ? `<@&${cfg.djRole}>` : "None", inline: true },
          { name: "Music Channel", value: cfg.musicChannel ? `<#${cfg.musicChannel}>` : "Any", inline: true },
          { name: "Default Volume", value: `${cfg.defaultVolume}%`, inline: true },
          { name: "Max Queue", value: `${cfg.maxQueueSize} songs`, inline: true },
          { name: "Auto Disconnect", value: `${cfg.autoDisconnectMs / 60000}min`, inline: true },
          { name: "Vote Skip %", value: `${cfg.voteskipPercent}%`, inline: true },
          { name: "Announce NP", value: cfg.announceNowPlaying ? "On" : "Off", inline: true },
        );
      return message.reply({ embeds: [embed] });
    }

    if (sub === "djrole") {
      const role = message.mentions.roles.first();
      cfg.djRole = role?.id ?? "";
      await setMusicConfig(message.guild.id, cfg);
      return message.reply(`✅ DJ role ${role ? `set to ${role}` : "cleared"}.`);
    }
    if (sub === "channel") {
      const ch = message.mentions.channels.first();
      cfg.musicChannel = ch?.id ?? "";
      await setMusicConfig(message.guild.id, cfg);
      return message.reply(`✅ Music channel ${ch ? `set to ${ch}` : "cleared (any channel)"}.`);
    }
    if (sub === "volume") {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 1 || n > 100) return message.reply("❌ Provide 1–100.");
      cfg.defaultVolume = n;
      await setMusicConfig(message.guild.id, cfg);
      return message.reply(`✅ Default volume: **${n}%**.`);
    }
    if (sub === "queue") {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 1) return message.reply("❌ Provide a positive number.");
      cfg.maxQueueSize = n;
      await setMusicConfig(message.guild.id, cfg);
      return message.reply(`✅ Max queue size: **${n}**.`);
    }
    if (sub === "disconnect") {
      const min = parseInt(args[1], 10);
      if (isNaN(min) || min < 0) return message.reply("❌ Provide minutes.");
      cfg.autoDisconnectMs = min * 60000;
      await setMusicConfig(message.guild.id, cfg);
      return message.reply(`✅ Auto-disconnect after **${min} minutes** of inactivity.`);
    }
    if (sub === "voteskip") {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 1 || n > 100) return message.reply("❌ Provide 1–100.");
      cfg.voteskipPercent = n;
      await setMusicConfig(message.guild.id, cfg);
      return message.reply(`✅ Vote skip threshold: **${n}%**.`);
    }
    if (sub === "announce") {
      cfg.announceNowPlaying = !cfg.announceNowPlaying;
      await setMusicConfig(message.guild.id, cfg);
      return message.reply(`✅ Now-playing announcements: **${cfg.announceNowPlaying ? "on" : "off"}**.`);
    }

    return message.reply("❌ Unknown subcommand.");
  },
};
