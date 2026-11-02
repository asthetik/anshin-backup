import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import log from 'electron-log/main'
import { IPC } from '../shared/ipc'
import type { EngineEvent, Settings } from '../shared/types'
import { applyAutoStart } from './autostart'
import { BackupEngine } from './engine'
import { registerIpc } from './ipc'
import { hideToTrayOnClose } from './linux'
import { SettingsStore } from './settings'
import { createTrayController, type TrayController } from './tray'

let mainWindow: BrowserWindow | null = null
let engine: BackupEngine | null = null
let settingsStore: SettingsStore | null = null
let tray: TrayController | null = null
let isQuitting = false
let shuttingDown = false

// 托盘在本机是否确定可见；GNOME 等无托盘环境关窗必须退出，否则应用失联
const hideToTray = hideToTrayOnClose(process.platform, process.env.XDG_CURRENT_DESKTOP)

// 必须在读取 userData 路径前设置，否则会落到包名 anshin-backup
app.setName('Anshin')
if (process.platform === 'win32') app.setAppUserModelId('com.anshin.backup')

function defaultSettings(): Settings {
  const locale = app.getLocale().toLowerCase()
  return {
    language: locale.startsWith('zh') ? 'zh' : 'en',
    autoStart: false,
    paused: false,
  }
}

function broadcast(event: EngineEvent): void {
  // 关窗即退的环境里窗口可能已销毁；往死窗口 send 会抛
  // "Object has been destroyed"，被引擎记成备份失败
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (event.type === 'state') tray?.refresh()
    return
  }
  mainWindow.webContents.send(IPC.engineEvent, event)
  if (event.type === 'state') tray?.refresh()
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 780,
    minHeight: 540,
    show: false,
    backgroundColor: '#fbfbf9',
    title: 'Anshin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // 系统默认的交通灯贴着窗口顶（中心在顶下 11px），和 56px 高的自定义标题栏不匹配，
    // 显式下移到跟标题文字同一水平线上；y=21 让灯中心（27px）与标题字形中心（27.5px）对齐，
    // 再往上 0.5px 是按用户实机截图校准的：再低会显得灯挂在文字下面
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 21 } } : {}),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.once('ready-to-show', () => window.show())

  window.on('close', (event) => {
    // 托盘可见才驻留；无托盘环境放行关闭，由 window-all-closed 负责退出
    if (isQuitting || !hideToTray) return
    event.preventDefault()
    window.hide()
  })

  // 放行关闭后窗口会真正销毁，悬空的引用会让后续 show/broadcast 抛错
  window.on('closed', () => {
    mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}

function showWindow(): void {
  if (!mainWindow) {
    mainWindow = createWindow()
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function sanitizePatch(patch: Partial<Settings>): Partial<Settings> {
  const clean: Partial<Settings> = {}
  if (patch.language === 'zh' || patch.language === 'en') clean.language = patch.language
  if (typeof patch.autoStart === 'boolean') clean.autoStart = patch.autoStart
  if (typeof patch.paused === 'boolean') clean.paused = patch.paused
  return clean
}

let settingsQueue: Promise<unknown> = Promise.resolve()

async function applySettings(patch: Partial<Settings>): Promise<Settings> {
  if (!settingsStore || !engine) throw new Error('Anshin is not ready')

  const before = settingsStore.get()
  const next = settingsStore.update(sanitizePatch(patch))

  if (next.autoStart !== before.autoStart) applyAutoStart(next.autoStart)
  if (next.paused !== before.paused) await engine.setPaused(next.paused)
  if (next.language !== before.language) tray?.refresh()

  return next
}

function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const run = (): Promise<Settings> => applySettings(patch)
  const result = settingsQueue.then(run, run)
  settingsQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

async function bootstrap(): Promise<void> {
  log.initialize()

  const userData = app.getPath('userData')
  settingsStore = new SettingsStore(join(userData, 'settings.json'), defaultSettings())
  const settings = settingsStore.get()

  engine = await BackupEngine.create({
    dbPath: join(userData, 'anshin.db'),
    onEvent: broadcast,
  })

  registerIpc({
    engine,
    getWindow: () => mainWindow,
    getSettings: () => settingsStore?.get() ?? settings,
    updateSettings,
  })

  mainWindow = createWindow()

  // 托盘创建失败(极端缺库/无托盘环境)不该连累整个应用:
  // 主窗口和引擎照常工作,否则自启的机器会每次开机即崩、备份全停
  try {
    tray = createTrayController({
      language: () => settingsStore?.get().language ?? 'en',
      isPaused: () => settingsStore?.get().paused ?? false,
      onOpen: showWindow,
      onBackupAll: () => {
        void engine?.backupAll().catch((error) => log.error('backup all failed', error))
      },
      onTogglePause: () => {
        const current = settingsStore?.get()
        if (!current) return
        void updateSettings({ paused: !current.paused }).catch((error) =>
          log.error('toggle pause failed', error),
        )
      },
      onOpenSettings: () => {
        showWindow()
        mainWindow?.webContents.send(IPC.requestSettings)
      },
      onQuit: () => {
        isQuitting = true
        app.quit()
      },
    })
  } catch (error) {
    log.error('创建托盘失败', error)
    tray = null
  }

  applyAutoStart(settings.autoStart)

  if (settings.paused) {
    await engine.setPaused(true)
  } else {
    engine.startAllWatchers()
    // 启动时对账，补齐应用未运行期间的变更
    void engine.backupAll().catch((error) => log.error('startup reconcile failed', error))
  }
}

const hasLock = app.requestSingleInstanceLock()

if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    } else {
      showWindow()
    }
  })

  app.on('window-all-closed', () => {
    // 托盘常驻：关闭窗口不退出；无托盘环境则关窗即退出
    if (!hideToTray) app.quit()
  })

  app.on('before-quit', (event) => {
    if (shuttingDown) return

    // 先排空运行中的备份再退出，避免留下半截文件
    event.preventDefault()
    shuttingDown = true
    isQuitting = true
    tray?.destroy()
    tray = null

    const draining = engine?.dispose() ?? Promise.resolve()
    engine = null

    void draining.catch((error) => log.error('dispose failed', error)).finally(() => app.quit())
  })

  app
    .whenReady()
    .then(bootstrap)
    .catch((error) => {
      log.error('Anshin failed to start', error)
      app.quit()
    })
}
