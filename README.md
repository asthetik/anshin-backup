English | [简体中文](README.zh-CN.md)

<p align="center">
  <img src="build/icon.png" width="88" alt="Anshin" />
</p>

<h1 align="center">Anshin</h1>

<p align="center"><strong>Peace of mind for the files you care about.</strong></p>

<p align="center"><a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3f6f5e.svg"></a></p>

Anshin keeps an up-to-date copy of the files you care about. Add the files you want to protect and choose where each copy should live. Whenever one of them changes, Anshin updates its copy in the background.

## What it does

- **Keeps a copy up to date** — add a file once; Anshin makes the first copy and updates it when the file changes
- **You choose where it goes** — next to the original, on another drive, or in a folder
- **Back up on demand** — back up one file, a selection, or all of them, with a clear confirmation
- **Runs in the tray** — close the window and Anshin keeps working
- **Pause anytime** — pause automatic backups from the window or tray

## Good to know

- Anshin keeps one current copy per file. There is no version history or restore yet.
- If a backup fails, your last good copy is left untouched.
- If you pick the original file's folder, the copy goes into a `backup/` subfolder.
- Everything stays on your computer: no account, cloud sync, or telemetry.
- Linux: the tray needs desktop support (native on KDE/XFCE/MATE/Cinnamon/Deepin and similar); where no tray can be shown (GNOME, elementary), closing the window quits Anshin instead of hiding it.

## Download

Download the latest build from [Releases](../../releases). Builds are unsigned for now, so macOS Gatekeeper and Windows SmartScreen may warn when you first open the app. If no release is available yet, build from source below.

## Status

v0.1 watches and copies individual files. Watching folders, version history, and restore are next.

## Build from source

Requires Node.js 22.22+ and pnpm.

```bash
pnpm install
pnpm dev
```

The first time you run `pnpm dev`, it downloads Electron. To build a release, run `pnpm dist`; the output goes to `release/`.

## Development

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest
pnpm lint        # Biome
pnpm build       # bundle main / preload / renderer
pnpm icons       # regenerate app and tray icons
```

Stack: Electron 45 · TypeScript 7 · React 19 · Tailwind CSS 4 · chokidar 6 · SQLite (`node:sqlite`).

App data: `~/Library/Application Support/Anshin` on macOS, `%APPDATA%\Anshin` on Windows, `$XDG_CONFIG_HOME/Anshin` on Linux.

## License

MIT
