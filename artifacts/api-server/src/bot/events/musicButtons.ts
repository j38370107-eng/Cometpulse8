import { Client } from "discord.js";
import { getLavalink, buildNowPlayingEmbed, buildPlayerButtons } from "../music/player";

export function registerMusicButtons(client: Client) {
  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.guildId) return;

    const { customId } = interaction;
    if (!customId.startsWith("music_")) return;

    let lavalink;
    try {
      lavalink = getLavalink();
    } catch {
      return interaction.reply({ content: "❌ Music system not ready.", ephemeral: true });
    }

    const player = lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: "❌ Nothing is playing.", ephemeral: true });
    }

    if (customId === "music_pause") {
      if (player.playing && !player.paused) {
        await player.pause();
        await interaction.reply({ content: "⏸️ Paused.", ephemeral: true });
      } else {
        await player.resume();
        await interaction.reply({ content: "▶️ Resumed.", ephemeral: true });
      }
    } else if (customId === "music_skip") {
      if (!player.queue.current) return interaction.reply({ content: "❌ Nothing to skip.", ephemeral: true });
      const title = player.queue.current.info.title;
      await player.skip();
      await interaction.reply({ content: `⏭️ Skipped **${title}**.`, ephemeral: true });
    } else if (customId === "music_stop") {
      await player.destroy();
      await interaction.reply({ content: "⏹️ Stopped and disconnected.", ephemeral: true });
    } else if (customId === "music_loop") {
      const next = player.repeatMode === "off" ? "track" : player.repeatMode === "track" ? "queue" : "off";
      await player.setRepeatMode(next);
      const icons = { off: "❌ Off", track: "🔂 Track", queue: "🔁 Queue" };
      await interaction.reply({ content: `Loop: **${icons[next]}**`, ephemeral: true });
    } else if (customId === "music_queue") {
      const current = player.queue.current;
      const lines = current
        ? [`🎵 **Now:** ${current.info.title}`, ...player.queue.tracks.slice(0, 9).map((t, i) => `**${i + 1}.** ${t.info.title}`)]
        : player.queue.tracks.slice(0, 10).map((t, i) => `**${i + 1}.** ${t.info.title}`);
      await interaction.reply({ content: lines.join("\n") || "Queue is empty.", ephemeral: true });
    }
  });
}
