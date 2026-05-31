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

## Streaming: yt-dlp binary (the working solution)
YouTube streaming via play-dl and ytdl-core both fail with "Invalid URL" / missing formats due to YouTube's current anti-bot measures. The fix is `yt-dlp`:

- Binary lives at `artifacts/api-server/bin/yt-dlp` (downloaded from GitHub releases, v2026.03.17)
- `spawnYtDlpStream(url)` in `player.ts` spawns it with `-f bestaudio[ext=webm]/bestaudio/best -o -`
- Output is piped as `StreamType.WebmOpus` into `createAudioResource`
- play-dl is still used for `search()` and `video_info()` (metadata only) — those still work fine

**Why:** YouTube now requires signed/encrypted stream URLs that play-dl 1.9.7 and @distube/ytdl-core cannot handle. yt-dlp is actively maintained and handles YouTube's current format.

**How to apply:** If streaming breaks again, update the yt-dlp binary: `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o artifacts/api-server/bin/yt-dlp && chmod +x artifacts/api-server/bin/yt-dlp`

## Voice connection fix
`joinAndPlay` now calls `await entersState(conn, VoiceConnectionStatus.Ready, 20_000)` before subscribing the player. Without this, the bot joins but playback silently fails.

## Why @discordjs/opus is NOT used
Native build fails on Replit's Nix sandbox. `opusscript` is the automatic fallback. Do NOT add `@discordjs/opus` to `onlyBuiltDependencies`.

## build.mjs externals required
`@discordjs/voice`, `@discordjs/opus`, `@snazzah/*`, `play-dl`, `play-opus`, `play-audio`, `opusscript`, `mediaplex`, `sodium-native`, `libsodium-wrappers`, `ffmpeg-static`
