[English](README.md) | 简体中文

<p align="center">
  <img src="build/icon.png" width="88" alt="Anshin" />
</p>

<h1 align="center">Anshin</h1>

<p align="center"><strong>给重要的文件，留一份安心的备份。</strong></p>

<p align="center">
  <a href="https://github.com/asthetik/anshin-backup/actions/workflows/ci.yml"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/asthetik/anshin-backup/ci.yml?branch=main&label=build"></a>
  <a href="https://github.com/asthetik/anshin-backup/releases"><img alt="Release" src="https://img.shields.io/github/v/release/asthetik/anshin-backup?color=3f6f5e&label=release"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3f6f5e.svg"></a>
</p>

Anshin 会为你选择的文件保留一份最新的副本。把要保护的文件加进来，再给每个副本选好位置，之后文件一有变化，它就在后台自动更新副本。

## 功能

- **自动更新副本** — 选好文件后立刻复制一份；之后文件一有变化，副本自动更新
- **备份位置由你决定** — 可以放在原文件旁边、另一块硬盘，或指定的文件夹
- **手动备份** — 单个、选中或全部文件都能立即备份，完成后有明确提示
- **托盘常驻** — 关掉窗口也继续工作
- **随时暂停** — 在窗口或托盘里暂停自动备份

## 几点说明

- 每个文件只保留一份最新副本；目前没有版本历史和还原。
- 如果备份失败，上一份好副本不会被覆盖。
- 如果备份位置选的是原文件所在文件夹，副本会放进其中的 `backup/` 子文件夹。
- 所有数据都留在本机：没有账号、云同步，也不会上传或收集你的数据。
- Linux：托盘图标需要桌面环境支持（KDE/XFCE/MATE/Cinnamon/Deepin 等原生可用）；无法显示托盘的环境（如默认 GNOME、elementary）下，关闭窗口会直接退出，而不是隐藏失联。

## 下载

到 [Releases](../../releases) 下载最新版本。安装包目前未签名，macOS Gatekeeper 和 Windows SmartScreen 首次打开时可能会提示。如果还没有发布版本，可以从下面的源码构建。

macOS 上如果提示「Anshin.app is damaged and can't be opened」（已损坏，无法打开），不要担心，这不是安装包损坏，只是系统拦截了未签名应用。把 App 拖到「应用程序」后，打开终端执行：

```bash
xattr -cr "/Applications/Anshin.app"
```

## 状态

v0.1 目前按文件监听和复制，可以添加多个文件。文件夹监听、版本历史和还原会在后续版本加入。

## 从源码构建

需要 Node.js 26+ 与 pnpm。

```bash
pnpm install
pnpm dev
```

首次运行 `pnpm dev` 时会下载 Electron。要打包，运行 `pnpm dist`；产物在 `release/`。

## 开发

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest
pnpm lint        # Biome
pnpm build       # 构建 main / preload / renderer
pnpm icons       # 重新生成应用与托盘图标
```

技术栈：Electron 45 · TypeScript 7 · React 19 · Tailwind CSS 4 · chokidar 6 · SQLite（`node:sqlite`）。

应用数据：macOS 为 `~/Library/Application Support/Anshin`，Windows 为 `%APPDATA%\Anshin`，Linux 为 `$XDG_CONFIG_HOME/Anshin`。

## 许可证

MIT
