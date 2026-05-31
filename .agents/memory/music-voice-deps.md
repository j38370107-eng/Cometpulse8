---
name: Music and voice dependencies
description: How the music system is wired — packages, build externals, streaming via yt-dlp
---

## Packages installed (api-server)
- `@discordjs/voice` — voice connection handling
- `play-dl` — YouTube search & metadata ONLY (streaming is broken as of 2026 due to YouTube API changes)
- `opusscript` — pure-JS opus encoder, automatic fallback when native @discordjs/opus is absent
- `ffmpeg-static` — ffmpeg binary
- `@distube/ytdl-core` — installed but also broken by YouTube API changes (can't parse decipher function)

## Music system: Lavalink 4.x (current solution)
Replaced @discordjs/voice + yt-dlp with full Lavalink setup. All previous streaming approaches (play-dl, @distube/ytdl-core, yt-dlp subprocess) were either broken or unreliable.

### Architecture
- **Lavalink Server**: `artifacts/lavalink/Lavalink.jar` (v4.2.2), runs as "Lavalink Server" workflow on port 2333
- **YouTube plugin**: `dev.lavalink.youtube:youtube-plugin:1.18.1` — downloaded by Lavalink on first start into `artifacts/lavalink/plugins/`
- **Node client**: `lavalink-client` v2.10.x in `artifacts/api-server`
- **Manager**: `artifacts/api-server/src/bot/music/lavalinkManager.ts` — singleton, initialized in ready event
- **Player helpers**: `artifacts/api-server/src/bot/music/player.ts` — re-exports getLavalink + embed/button builders
- **Raw events**: `bot/index.ts` passes `client.on("raw", d => getLavalink().sendRawData(d))` for voice state updates

### Java
- Java 21 installed via `installSystemDependencies({ packages: ["jdk"] })` — OpenJDK 21.0.7
- Required for Lavalink 4.x (needs Java 17+)

### Lavalink config: `artifacts/lavalink/application.yml`
- Password: `youshallnotpass` (override with `LAVALINK_PASSWORD` env var)
- YouTube source plugin enabled; built-in youtube: false
- YouTube clients: WEB_REMIX, WEB, TVHTML5_SIMPLY_EMBEDDED_PLAYER (ANDROID_TESTSUITE failed to resolve)

### If plugin version breaks (YouTube changes):
Update `artifacts/lavalink/application.yml` plugin version and restart the Lavalink Server workflow.

## build.mjs externals required
`lavalink-client`, `@discordjs/voice`, `@discordjs/opus`, `@snazzah/*`, `play-dl`, `opusscript`, `mediaplex`, `sodium-native`, `libsodium-wrappers`, `ffmpeg-static`
