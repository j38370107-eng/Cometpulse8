---
name: Music and voice dependencies
description: How the music system is wired — packages, build externals, and opus fallback strategy
---

## Packages installed (api-server)
- `@discordjs/voice` — voice connection handling
- `play-dl` — YouTube/SoundCloud audio streaming (pure-JS, no binary needed)
- `opusscript` — pure-JS opus encoder, used as automatic fallback when native @discordjs/opus is absent
- `ffmpeg-static` — ffmpeg binary (build script runs via onlyBuiltDependencies in pnpm-workspace.yaml)

## Why @discordjs/opus is NOT used
Native build (`node-pre-gyp`) fails on Replit's Nix sandbox for this package. `opusscript` is the automatic fallback inside `@discordjs/voice` and works without native binaries. Do NOT add `@discordjs/opus` to `onlyBuiltDependencies` — it will break `pnpm install`.

## build.mjs externals required
These must be in the `external` array or esbuild fails:
- `@discordjs/voice`
- `@discordjs/opus`
- `@snazzah/*` (native .node binding — dep of @discordjs/voice)
- `play-dl`
- `play-opus`
- `play-audio`
- `opusscript`
- `mediaplex`
- `sodium-native`
- `libsodium-wrappers`
- `ffmpeg-static`

**Why:** esbuild cannot bundle native `.node` files or packages that dynamically require opus codecs. Marking them external lets Node.js resolve them at runtime from node_modules instead.

## How to apply
Any time a new voice/audio package is added, check if it has native bindings or dynamic requires — add it to the `external` list in `artifacts/api-server/build.mjs` before building.
