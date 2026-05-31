import { Message, EmbedBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../types";
import type { Player } from "lavalink-client";
import { getLavalink, formatDuration, buildNowPlayingEmbed, buildPlayerButtons } from "../../music/player";
import { getMusicConfig, setMusicConfig } from "../../store/musicConfig";

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

async function getOrCreatePlayer(member: GuildMember, message: Message): Promise<Player> {
  const guildId = message.guild!.id;
  const vc = member.voice.channel!;
  const cfg = await getMusicConfig(guildId);
  const lavalink = getLavalink();

  let player = lavalink.getPlayer(guildId);
  if (!player) {
    player = await lavalink.createPlayer({
      guildId,
      voiceChannelId: vc.id,
      textChannelId: message.channelId,
      selfDeaf: true,
      volume: cfg.defaultVolume,
    });
  }
  if (!player.connected) await player.connect();
  return player;
}

export const playCommand: Command = {
  name: "play",
  aliases: ["p"],
  description: "Play a song or add it to the queue",
  usage: "play <song name or URL>",
  async execute(message, args) {
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
      const player = await getOrCreatePlayer(member, message);
      const res = await player.search({ query }, message.author);

      if (res.loadType === "empty" || res.loadType === "error") {
        if (!player.queue.current && player.queue.tracks.length === 0) await player.destroy();
        return msg.edit("❌ No results found.");
      }

      const wasActive = player.playing || player.paused || !!player.queue.current;

      if (res.loadType === "playlist") {
        await player.queue.add(res.tracks);
        if (!player.playing && !player.paused) await player.play();
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("➕ Playlist Added")
          .setDescription(`**${res.playlist?.name ?? "Playlist"}**`)
          .addFields({ name: "Tracks", value: `${res.tracks.length} songs added`, inline: true });
        return msg.edit({ content: "", embeds: [embed] });
      }

      const track = res.tracks[0];
      await player.queue.add(track);
      if (!player.playing && !player.paused) await player.play();

      if (wasActive) {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("➕ Added to Queue")
          .setDescription(`**[${track.info.title}](${track.info.uri})**`)
          .setThumbnail(track.info.artworkUrl || null)
          .addFields(
            { name: "Duration", value: formatDuration(track.info.duration), inline: true },
            { name: "Position", value: `#${player.queue.tracks.length}`, inline: true },
          );
        return msg.edit({ content: "", embeds: [embed] });
      }

      return msg.edit({ content: "", embeds: [buildNowPlayingEmbed(track, player)] });
    } catch (err: any) {
      return msg.edit(`❌ ${err.message ?? "Playback error. Make sure the Lavalink server is running."}`);
    }
  },
};

export const skipCommand: Command = {
  name: "skip",
  aliases: ["s"],
  description: "Skip the current song",
  usage: "skip",
  async execute(message) {
    if (!message.guild) return;
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player?.queue.current) return message.reply("❌ Nothing is playing.");
    if (!await isDj(message)) {
      const vc = (message.member as GuildMember).voice.channel;
      if (!vc) return message.reply("❌ You must be in a voice channel.");
      const members = vc.members.filter(m => !m.user.bot).size;
      const needed = Math.ceil(members * ((await getMusicConfig(message.guild.id)).voteskipPercent / 100));
      return message.reply(`🗳️ Vote skip needs ${needed} votes.`);
    }
    const title = player.queue.current.info.title;
    await player.skip();
    return message.reply(`⏭️ Skipped **${title}**.`);
  },
};

export const stopCommand: Command = {
  name: "stop",
  aliases: ["disconnect", "dc"],
  description: "Stop music and disconnect",
  usage: "stop",
  async execute(message) {
    if (!message.guild) return;
    if (!await isDj(message)) return message.reply("❌ DJ role required.");
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player) return message.reply("❌ Nothing is playing.");
    await player.destroy();
    return message.reply("⏹️ Stopped music and disconnected.");
  },
};

export const pauseCommand: Command = {
  name: "pause",
  aliases: [],
  description: "Pause the current song",
  usage: "pause",
  async execute(message) {
    if (!message.guild) return;
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player?.queue.current) return message.reply("❌ Nothing is playing.");
    await player.pause();
    return message.reply("⏸️ Paused.");
  },
};

export const resumeCommand: Command = {
  name: "resume",
  aliases: ["unpause"],
  description: "Resume the paused song",
  usage: "resume",
  async execute(message) {
    if (!message.guild) return;
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player) return message.reply("❌ Nothing is paused.");
    await player.resume();
    return message.reply("▶️ Resumed.");
  },
};

export const queueCommand: Command = {
  name: "queue",
  aliases: ["q"],
  description: "View the current queue",
  usage: "queue [page]",
  async execute(message, args) {
    if (!message.guild) return;
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      return message.reply("📭 Queue is empty.");
    }

    const page = Math.max(1, parseInt(args[0], 10) || 1);
    const perPage = 10;
    const start = (page - 1) * perPage;
    const total = player.queue.tracks.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    const embed = new EmbedBuilder().setTitle("📜 Queue").setColor(0x5865F2);

    if (player.queue.current) {
      embed.addFields({
        name: "🎵 Now Playing",
        value: `[${player.queue.current.info.title}](${player.queue.current.info.uri}) — ${formatDuration(player.queue.current.info.duration)}`,
      });
    }

    const slice = player.queue.tracks.slice(start, start + perPage);
    if (slice.length > 0) {
      embed.addFields({
        name: `Up Next (${total} total)`,
        value: slice.map((t, i) => {
          const req = (t.requester as any);
          return `**${start + i + 1}.** [${t.info.title}](${t.info.uri}) — ${formatDuration(t.info.duration)}${req ? ` — <@${req.id}>` : ""}`;
        }).join("\n"),
      });
    }

    embed.setFooter({ text: `Page ${page}/${totalPages} • Loop: ${player.repeatMode} • Volume: ${player.volume}%` });
    return message.reply({ embeds: [embed] });
  },
};

export const nowPlayingCommand: Command = {
  name: "nowplaying",
  aliases: ["np"],
  description: "Show what's currently playing",
  usage: "nowplaying",
  async execute(message) {
    if (!message.guild) return;
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player?.queue.current) return message.reply("❌ Nothing is playing.");
    return message.reply({
      embeds: [buildNowPlayingEmbed(player.queue.current, player)],
      components: [buildPlayerButtons(player)],
    });
  },
};

export const volumeCommand: Command = {
  name: "volume",
  aliases: ["vol"],
  description: "Set the volume (0-100)",
  usage: "volume <0-100>",
  async execute(message, args) {
    if (!message.guild) return;
    if (!await isDj(message)) return message.reply("❌ DJ role required.");
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player) return message.reply("❌ Nothing is playing.");
    const vol = parseInt(args[0], 10);
    if (isNaN(vol) || vol < 0 || vol > 100) return message.reply("❌ Volume must be 0–100.");
    await player.setVolume(vol);
    return message.reply(`🔊 Volume set to **${vol}%**.`);
  },
};

export const loopCommand: Command = {
  name: "loop",
  aliases: ["repeat"],
  description: "Toggle loop mode (off/track/queue)",
  usage: "loop [track|queue|off]",
  async execute(message, args) {
    if (!message.guild) return;
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player) return message.reply("❌ Nothing is playing.");
    const mode = args[0]?.toLowerCase();
    let next: "off" | "track" | "queue";
    if (mode === "track") next = "track";
    else if (mode === "queue") next = "queue";
    else if (mode === "off" || mode === "none") next = "off";
    else next = player.repeatMode === "off" ? "track" : player.repeatMode === "track" ? "queue" : "off";
    await player.setRepeatMode(next);
    const icons = { off: "❌ Off", track: "🔂 Track", queue: "🔁 Queue" };
    return message.reply(`Loop: **${icons[next]}**`);
  },
};

export const shuffleCommand: Command = {
  name: "shuffle",
  aliases: [],
  description: "Shuffle the queue",
  usage: "shuffle",
  async execute(message) {
    if (!message.guild) return;
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player || player.queue.tracks.length < 2) return message.reply("❌ Not enough songs to shuffle.");
    await player.queue.shuffle();
    return message.reply(`🔀 Shuffled ${player.queue.tracks.length} songs.`);
  },
};

export const removeCommand: Command = {
  name: "remove",
  aliases: ["rm"],
  description: "Remove a song from the queue",
  usage: "remove <position>",
  async execute(message, args) {
    if (!message.guild) return;
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player || player.queue.tracks.length === 0) return message.reply("❌ Queue is empty.");
    const pos = parseInt(args[0], 10);
    if (isNaN(pos) || pos < 1 || pos > player.queue.tracks.length) return message.reply("❌ Invalid position.");
    const removed = player.queue.tracks[pos - 1];
    await player.queue.remove(pos - 1);
    return message.reply(`🗑️ Removed **${removed.info.title}**.`);
  },
};

export const clearQueueCommand: Command = {
  name: "clearqueue",
  aliases: ["cq"],
  description: "Clear the song queue",
  usage: "clearqueue",
  async execute(message) {
    if (!message.guild) return;
    if (!await isDj(message)) return message.reply("❌ DJ role required.");
    const player = getLavalink().getPlayer(message.guild.id);
    if (!player) return message.reply("❌ Nothing is playing.");
    await player.queue.splice(0, player.queue.tracks.length);
    return message.reply("🗑️ Queue cleared.");
  },
};

export const searchCommand: Command = {
  name: "search",
  aliases: [],
  description: "Search for songs and pick one",
  usage: "search <query>",
  async execute(message, args) {
    if (!message.guild) return;
    const member = message.member as GuildMember;
    if (!member.voice.channel) return message.reply("❌ Join a voice channel first.");

    const query = args.join(" ").trim();
    if (!query) return message.reply("❌ Provide a search query.");

    const player = await getOrCreatePlayer(member, message);
    const res = await player.search({ query }, message.author);

    if (!res.tracks.length) return message.reply("❌ No results found.");
    const results = res.tracks.slice(0, 5);

    const embed = new EmbedBuilder()
      .setTitle("🔍 Search Results")
      .setColor(0x5865F2)
      .setDescription(results.map((r, i) => `**${i + 1}.** [${r.info.title}](${r.info.uri}) — ${formatDuration(r.info.duration)}`).join("\n"))
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

    const wasActive = player.playing || player.paused || !!player.queue.current;
    await player.queue.add(track);
    if (!player.playing && !player.paused) await player.play();

    return msg.edit({
      content: wasActive ? `✅ Added **${track.info.title}** to queue at position #${player.queue.tracks.length}.` : "",
      embeds: wasActive ? [] : [buildNowPlayingEmbed(track, player)],
    });
  },
};

export const musicConfigCommand: Command = {
  name: "musicconfig",
  aliases: ["mc"],
  description: "Configure the music system",
  usage: "musicconfig <djrole|channel|volume|queue|disconnect|voteskip|announce> [value]",
  async execute(message, args) {
    if (!message.guild) return;
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("❌ Manage Server required.");
    }

    const cfg = await getMusicConfig(message.guild.id);
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
