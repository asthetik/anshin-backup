// 从 Electron 宿主（IDE / 终端）继承 ELECTRON_RUN_AS_NODE=1 时，electron-vite 启动的
// Electron 会退化成 Node，主进程 `import { BrowserWindow } from 'electron'` 直接报错。
// 这里先触发 Electron 二进制的按需安装（electron-vite 只查 path.txt，不会自己下载），
// 再清掉该变量启动 dev server。
//
// 有些环境（例如被文件沙箱包住的终端）不允许 Electron 写默认的 userData 目录，
// 也不允许 Chromium sandbox 初始化；检测到就退到工作区内的 .dev-data 并关闭 sandbox。
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const ROOT = join(import.meta.dirname, '..')

delete process.env.ELECTRON_RUN_AS_NODE

try {
  require('electron')
} catch (error) {
  console.error('[dev] Electron 二进制不可用：', error instanceof Error ? error.message : error)
  process.exit(1)
}

function defaultUserData() {
  if (process.platform === 'darwin')
    return join(homedir(), 'Library', 'Application Support', 'Anshin')
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Anshin')
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'Anshin')
}

function isWritable(dir) {
  try {
    mkdirSync(dir, { recursive: true })
    const probe = join(dir, '.anshin-write-probe')
    writeFileSync(probe, '')
    rmSync(probe)
    return true
  } catch {
    return false
  }
}

const electronArgs = []
if (!isWritable(defaultUserData())) {
  const fallback = join(ROOT, '.dev-data', 'user-data')
  mkdirSync(fallback, { recursive: true })
  electronArgs.push(`--user-data-dir=${fallback}`, '--no-sandbox')
  console.warn(
    '[dev] 默认 userData 不可写，改用 .dev-data/user-data 并关闭 Chromium sandbox（仅当前环境）',
  )
}

const electronViteRoot = dirname(require.resolve('electron-vite/package.json'))
const cli = join(electronViteRoot, 'bin', 'electron-vite.js')
const args = [cli, 'dev', ...process.argv.slice(2)]
if (electronArgs.length > 0) args.push('--', ...electronArgs)
const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
