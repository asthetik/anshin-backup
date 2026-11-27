import { join } from 'node:path'
import type { Event, Input, MessageBoxReturnValue } from 'electron'
import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import log from 'electron-log/main'
import { IPC } from '../shared/ipc'
import { knownSettingsFields } from '../shared/settings'
import type { CloseChoice, EngineEvent, Language, Settings } from '../shared/types'
import { applyAutoStart } from './autostart'
import { applyCloseChoice, createCloseChoiceGate } from './closeChoice'
import { BackupEngine } from './engine'
import { mainT } from './i18n'
import { registerIpc } from './ipc'
import { hideToTrayOnClose } from './linux'
import { SettingsStore } from './settings'
import { createTrayController, type TrayController } from './tray'

let mainWindow: BrowserWindow | null = null
let engine: BackupEngine | null = null
let settingsStore: SettingsStore | null = null
let tray: TrayController | null = null
let isQuitting = false

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
    hideDockOnClose: false,
    closeNoticeAcknowledged: false,
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

// ---- 关窗驻留的 Dock 图标管理 ----

// Electron 已知问题：距上一次 dock 调用 1 秒内的 hide() 会被忽略，
// 快速关-开-关会把图标卡在显示态；dock 调用集中在这里串行化
let lastDockOpAt = 0
let pendingDockHide: NodeJS.Timeout | null = null

function setDockHidden(hidden: boolean): void {
  if (pendingDockHide) {
    clearTimeout(pendingDockHide)
    pendingDockHide = null
  }
  if (!hidden) {
    lastDockOpAt = Date.now()
    app.dock?.show()
    return
  }
  const wait = Math.max(0, 1100 - (Date.now() - lastDockOpAt))
  pendingDockHide = setTimeout(() => {
    pendingDockHide = null
    lastDockOpAt = Date.now()
    if (!isQuitting) app.dock?.hide()
  }, wait)
}

// 全屏关窗先退全屏再收；转换期间窗口若被重新唤起或重进全屏，挂起的收起回调要作废。
// 用代数计数而非移除监听：转换中途重进全屏时 leave-full-screen 可能再不触发，
// 靠移除监听会让回调悬空；回调自己核对代数，过期就什么都不做
let fullscreenHideGeneration = 0

function cancelPendingFullscreenHide(): void {
  fullscreenHideGeneration += 1
}

// 关窗驻留：窗口收起；开启「隐藏程序坞图标」时同时收起 Dock。
// 全屏下直接 hide 会留一块黑屏，先退出全屏，等 leave-full-screen 再收
function hideWindowToTray(window: BrowserWindow): void {
  cancelPendingFullscreenHide()
  const generation = fullscreenHideGeneration

  const hide = (): void => {
    // 转换期间窗口被重新唤起，或又退出了全屏转换，这次收起作废
    if (generation !== fullscreenHideGeneration) return
    if (window.isDestroyed() || isQuitting) return
    window.hide()
    if (settingsStore?.get().hideDockOnClose) setDockHidden(true)
  }

  if (process.platform === 'darwin' && window.isFullScreen()) {
    window.once('leave-full-screen', hide)
    window.setFullScreen(false)
    return
  }
  hide()
}

// 首次关窗的平台分流：macOS 用原生弹框问程序坞图标去留（选择即开关的
// 首次赋值，Esc 走默认「保留」并记档）；Windows 把问题发到渲染进程，用与
// 界面一致的弹窗问是否驻留后台（是→收起，否→退出，取消不算回答，下次再问）；
// Linux 不打扰。之后关窗直接收起
// 关窗询问的两类「悬着」状态（原生弹框 / 界面内弹窗）收敛到一个门控对象，
// 行为与原先的旗标一致；纯函数实现见 closeChoice.ts，tests/closeChoice.test.ts 钉住
const closeChoiceGate = createCloseChoiceGate()

function hideToTrayWithNotice(window: BrowserWindow): void {
  const settings = settingsStore?.get()
  if (!settings || settings.closeNoticeAcknowledged) {
    hideWindowToTray(window)
    return
  }

  if (process.platform === 'linux') {
    hideWindowToTray(window)
    return
  }

  if (process.platform === 'darwin') {
    // 反复点 X 只弹一次
    if (closeChoiceGate.isNativePending()) return
    closeChoiceGate.nativeOpened()
    const language = settings.language

    let box: Promise<MessageBoxReturnValue>
    try {
      box = dialog.showMessageBox(window, {
        type: 'question',
        message: mainT(language, 'dockChoiceTitle'),
        buttons: [mainT(language, 'dockChoiceKeep'), mainT(language, 'dockChoiceHide')],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
    } catch (error) {
      // 同步抛出（如原生弹框分配失败）时 promise 不会创建，.finally 无从
      // 执行；就地复位旗标，关窗按钮与托盘设置入口不能从此卡死
      closeChoiceGate.nativeOpenFailed()
      log.error('弹出关窗询问失败', error)
      return
    }
    void box
      .then((result) => {
        // 保留=0（默认/Esc）隐藏=1；选择即 hideDockOnClose 的首次赋值
        try {
          settingsStore?.update({
            closeNoticeAcknowledged: true,
            hideDockOnClose: result.response === 1,
          })
        } catch (error) {
          // 写盘失败（文件被占用/磁盘满）不能把用户的回答吞掉：照常驻留，
          // 只是设置没落盘，下次启动还会再问一次（与 performCloseChoice 同一取舍）
          log.error('记录关窗选择失败', error)
        }
        if (!window.isDestroyed()) hideWindowToTray(window)
      })
      .catch(() => {
        // 弹框异常（如退出时窗口被销毁）按未回答处理：窗口留在原地，下次再问
      })
      .finally(() => {
        closeChoiceGate.nativeSettled()
      })
    return
  }

  // Windows：确认弹窗画在渲染进程里（原生消息框与整体 UI 风格不符）
  if (window.isDestroyed()) return

  // 渲染进程已崩时界面弹窗无处可画：退回原生消息框问同一个问题，
  // 不能让关窗按钮从此无声失效
  if (window.webContents.isCrashed()) {
    askCloseChoiceNatively(window, settings.language)
    return
  }

  // 问题还悬着：窗口可能被最小化，或弹窗请求被尚未就绪的渲染进程错过。
  // 带回前台并重发一次请求（渲染侧 setCloseChoiceOpen(true) 幂等）
  if (closeChoiceGate.isRequestOutstanding()) {
    if (window.isMinimized()) window.restore()
    window.focus()
    window.webContents.send(IPC.requestCloseChoice)
    return
  }

  closeChoiceGate.requestSent()
  window.webContents.send(IPC.requestCloseChoice)
}

// 渲染进程不可用时的原生版关窗询问；回答走同一条 performCloseChoice
function askCloseChoiceNatively(window: BrowserWindow, language: Language): void {
  if (closeChoiceGate.isNativePending()) return
  closeChoiceGate.nativeOpened()

  let box: Promise<MessageBoxReturnValue>
  try {
    box = dialog.showMessageBox(window, {
      type: 'question',
      message: mainT(language, 'closeAskTitle'),
      detail: mainT(language, 'closeAskBody'),
      buttons: [mainT(language, 'closeAskBackground'), mainT(language, 'closeAskQuit')],
      defaultId: 0,
      cancelId: -1,
      noLink: true,
    })
  } catch (error) {
    // 同步抛出时 promise 不会创建，.finally 无从执行；就地复位旗标
    closeChoiceGate.nativeOpenFailed()
    log.error('弹出关窗询问失败', error)
    return
  }
  void box
    .then((result) => {
      const choice: CloseChoice =
        result.response === 0 ? 'background' : result.response === 1 ? 'quit' : 'cancel'
      performCloseChoice(choice)
    })
    .catch(() => {
      // 弹框异常（如退出时窗口被销毁）按未回答处理：窗口留在原地，下次再问
    })
    .finally(() => {
      closeChoiceGate.nativeSettled()
    })
}

function performCloseChoice(choice: CloseChoice): void {
  closeChoiceGate.requestAnswered()
  // 分类与裁决在 closeChoice.ts：未识别的值一律按「取消」处理，绝不落到
  // 「退出」；quit 是一次性动作不落档；写档失败不能吞掉回答，照常驻留
  applyCloseChoice(choice, {
    quit: () => {
      isQuitting = true
      app.quit()
    },
    acknowledge: () => settingsStore?.update({ closeNoticeAcknowledged: true }),
    hide: () => {
      if (mainWindow && !mainWindow.isDestroyed()) hideWindowToTray(mainWindow)
    },
    onError: (error) => log.error('记录关窗选择失败', error),
  })
}

function createWindow(): BrowserWindow {
  // 新建的窗口必然可见，Dock 图标同步可见（覆盖 activate 直建窗口的路径）
  setDockHidden(false)
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

  // 菜单已移除，Windows/Linux 开发态没有 DevTools/刷新快捷键入口；补回
  // F12 与 Ctrl+R（按住不放的自动重复不算新按键，带修饰键的组合也不响应）。
  // 用 input.code 而非 input.key：后者随键盘布局变化，非拉丁布局下会失灵
  if (!app.isPackaged) {
    window.webContents.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown' || input.isAutoRepeat) return
      const plain = !input.alt && !input.control && !input.meta && !input.shift
      if (plain && input.code === 'F12') {
        window.webContents.toggleDevTools()
        return
      }
      if (input.control && !input.alt && !input.meta && !input.shift && input.code === 'KeyR') {
        window.webContents.reload()
      }
    })
    // 焦点进了 DevTools 后页面侧收不到 F12，DevTools 自己补一个关闭入口。
    // devToolsWebContents 在开关之间复用，直接 on 会随开关次数叠加监听，
    // 关闭时摘掉本次挂上的处理器
    window.webContents.on('devtools-opened', () => {
      const devTools = window.webContents.devToolsWebContents
      if (!devTools) return
      const closeOnF12 = (_event: Event, input: Input): void => {
        if (input.type !== 'keyDown' || input.isAutoRepeat) return
        const plain = !input.alt && !input.control && !input.meta && !input.shift
        if (plain && input.code === 'F12') window.webContents.closeDevTools()
      }
      devTools.on('before-input-event', closeOnF12)
      window.webContents.once('devtools-closed', () => {
        devTools.removeListener('before-input-event', closeOnF12)
      })
    })
  }

  // 渲染进程重载或崩溃后，界面内弹窗的状态随之丢失；作废「问题悬着」的
  // 记号，托盘设置入口不再被陈旧旗标拦住，下次关窗会重新发问
  window.webContents.on('did-finish-load', () => {
    closeChoiceGate.rendererRecovered()
  })
  // 非退出流程中的渲染进程崩溃自动重载自愈：生产版没有刷新快捷键，
  // 白屏窗口对非技术用户是死胡同（对抗审查与 Red Team 收敛指认）
  window.webContents.on('render-process-gone', (_event, details) => {
    closeChoiceGate.rendererRecovered()
    if (!isQuitting && details.reason !== 'clean-exit') {
      window.webContents.reloadIgnoringCache()
    }
  })

  window.on('close', (event) => {
    // 托盘可见才驻留；无托盘环境放行关闭，由 window-all-closed 负责退出
    if (isQuitting || !hideToTray) return
    event.preventDefault()
    hideToTrayWithNotice(window)
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
  // 窗口回来时 Dock 图标一起回来；同步作废挂起的收起
  // （推迟中的 dock.hide、全屏转换途中的收起回调）
  cancelPendingFullscreenHide()
  setDockHidden(false)
  if (!mainWindow) {
    mainWindow = createWindow()
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

let settingsQueue: Promise<unknown> = Promise.resolve()

async function applySettings(patch: Partial<Settings>): Promise<Settings> {
  if (!settingsStore || !engine) throw new Error('Anshin is not ready')

  const before = settingsStore.get()
  const next = settingsStore.update(knownSettingsFields(patch))

  if (next.autoStart !== before.autoStart) applyAutoStart(next.autoStart)
  // 用户拨过这个开关等于已回答过首关弹框的问题，之后关窗不再问
  if (next.hideDockOnClose !== before.hideDockOnClose) {
    settingsStore.update({ closeNoticeAcknowledged: true })
  }
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

  // Windows/Linux 会把默认菜单栏（File/Edit/View/Window）画进窗口，与自绘
  // 标题栏叠成两行；界面完全依赖应用内按钮，直接移除。macOS 保持系统菜单
  // （Cmd+Q 等快捷键挂在上面），不能动
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)

  const userData = app.getPath('userData')
  settingsStore = new SettingsStore(join(userData, 'settings.toml'), defaultSettings())
  const settings = settingsStore.get()

  engine = await BackupEngine.create({
    dbPath: join(userData, 'anshin.db'),
    onEvent: broadcast,
  })

  // 退出抢在启动完成前到达时，刚建好的引擎要就地释放；
  // 否则 will-quit 已放过（当时 engine 还是 null），这个引擎再没人关。
  // exit(0) 兜底：不依赖自然退出序列真的走到进程终止
  if (isQuitting) {
    await engine.dispose()
    engine = null
    app.exit(0)
    return
  }

  registerIpc({
    engine,
    getWindow: () => mainWindow,
    getSettings: () => settingsStore?.get() ?? settings,
    updateSettings,
    onCloseChoice: performCloseChoice,
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
        // 关窗问题还悬着时先答它，设置等下次再开，避免两个弹窗叠在一起
        // （原生弹框与界面弹窗两类「悬着」都收在同一个门控对象里）
        if (closeChoiceGate.isSettingsEntryBlocked()) return
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
  app.on('second-instance', () => {
    // 退出排干期间的二次启动不应再开窗口
    if (isQuitting) return
    showWindow()
  })

  app.on('activate', () => {
    if (isQuitting) return
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

  app.on('before-quit', () => {
    isQuitting = true
    // 排干期间（最多 10 秒）窗口已收、托盘已毁，推迟中的 dock.hide 若不
    // 立即兑现，图标会以死状态挂在程序坞直到进程退出。距上次 dock 调用
    // 不足 1 秒时 macOS 可能忽略这次 hide，但进程退出后图标总会消失，
    // 只是排干期间短暂可见，可接受
    if (pendingDockHide) {
      clearTimeout(pendingDockHide)
      pendingDockHide = null
      app.dock?.hide()
    }
    tray?.destroy()
    tray = null
  })

  // 排干放在 will-quit：窗口已关、界面立即消失，备份在后台收尾。
  // 不能用 before-quit + preventDefault + 二次 app.quit() 的写法——
  // 第二次 quit 可能赶在首次退出序列收尾的窗口期里被吞掉，进程带着
  // 已关闭的数据库残留，重开经单实例锁落回旧进程后所有 IPC 都报
  // "database is not open"（用户实测遇到的僵尸态）。
  app.on('will-quit', (event) => {
    const draining = engine
    if (!draining) return

    event.preventDefault()
    engine = null

    // 排干设上限：卡死的文件操作不能把无窗口无托盘的进程变成隐形
    // 僵尸；原子复制保证强杀时上一份副本完好，没做完的下次启动对账补齐
    const forceExit = setTimeout(() => {
      log.warn('engine dispose timed out, forcing exit')
      app.exit(0)
    }, 10_000)

    void draining
      .dispose()
      .catch((error) => log.error('dispose failed', error))
      .finally(() => {
        clearTimeout(forceExit)
        app.exit(0)
      })
  })

  app
    .whenReady()
    .then(bootstrap)
    .catch((error) => {
      log.error('Anshin failed to start', error)
      app.quit()
    })
}
