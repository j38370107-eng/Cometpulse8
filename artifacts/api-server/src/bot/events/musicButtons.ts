import { Client } from "discord.js";
import { getQueue, destroyQueue, buildNowPlayingEmbed, buildPlayerButtons } from "../music/player";

export function registerMusicButtons(client: Client) {
  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.guildId) return;

    const { customId } = interaction;
    if (!customId.startsWith("music_")) return;

    const q = getQueue(interaction.guildId);
    if (!q) {
      return interaction.reply({ content: "❌ Nothing is playing.", ephemeral: true });
    }

    if (customId === "music_pause") {
      if (q.playing) {
        q.player.pause();
        q.playing = false;
        await interaction.reply({ content: "⏸️ Paused.", ephemeral: true });
      } else {
        q.player.unpause();
        q.playing = true;
        await interaction.reply({ content: "▶️ Resumed.", ephemeral: true });
      }
    } else if (customId === "music_skip") {
      if (!q.current) return interaction.reply({ content: "❌ Nothing to skip.", ephemeral: true });
      const title = q.current.title;
      q.player.stop();
      await interaction.reply({ content: `⏭️ Skipped **${title}**.`, ephemeral: true });
    } else if (customId === "music_stop") {
      destroyQueue(interaction.guildId);
      await interaction.reply({ content: "⏹️ Stopped and disconnected.", ephemeral: true });
    } else if (customId === "music_loop") {
      q.loop = q.loop === "none" ? "track" : q.loop === "track" ? "queue" : "none";
      const icons = { none: "❌ Off", track: "🔂 Track", queue: "🔁 Queue" };
      await interaction.reply({ content: `Loop: **${icons[q.loop]}**`, ephemeral: true });
    } else if (customId === "music_queue") {
      const lines = q.current
        ? [`🎵 **Now:** ${q.current.title}`, ...q.tracks.slice(0, 9).map((t, i) => `**${i + 1}.** ${t.title}`)]
        : q.tracks.slice(0, 10).map((t, i) => `**${i + 1}.** ${t.title}`);
      await interaction.reply({ content: lines.join("\n") || "Queue is empty.", ephemeral: true });
    }
  });
}
