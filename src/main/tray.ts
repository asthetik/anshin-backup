import { Menu, nativeImage, screen, Tray } from 'electron'
import trayTemplate from '../../resources/trayTemplate.png?asset'
import trayWindows16 from '../../resources/trayWindows16.png?asset'
import trayWindows20 from '../../resources/trayWindows20.png?asset'
import trayWindows24 from '../../resources/trayWindows24.png?asset'
import trayWindows32 from '../../resources/trayWindows32.png?asset'
import type { Language } from '../shared/types'
import { mainT } from './i18n'
import { pickTrayIconSize } from './trayIcon'

const WINDOWS_TRAY_ICONS = {
  16: trayWindows16,
  20: trayWindows20,
  24: trayWindows24,
  32: trayWindows32,
} as const

function createTrayImage() {
  // macOS 用 template 图，系统会按菜单栏深浅色自动反色；Windows/Linux 没有这一层，
  // 得自己挑一张在深浅任务栏上都看得清的图
  if (process.platform === 'darwin') {
    const image = nativeImage.createFromPath(trayTemplate)
    image.setTemplateImage(true)
    return image
  }

  const size = pickTrayIconSize(screen.getPrimaryDisplay().scaleFactor)
  return nativeImage.createFromPath(WINDOWS_TRAY_ICONS[size])
}

export interface TrayContext {
  language(): Language
  isPaused(): boolean
  onOpen(): void
  onBackupAll(): void
  onTogglePause(): void
  onOpenSettings(): void
  onQuit(): void
}

export interface TrayController {
  refresh(): void
  destroy(): void
}

export function createTrayController(context: TrayContext): TrayController {
  const image = createTrayImage()

  const tray = new Tray(image)

  const refresh = (): void => {
    const language = context.language()
    tray.setToolTip(mainT(language, 'tooltip'))
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: mainT(language, 'open'), click: () => context.onOpen() },
        { type: 'separator' },
        { label: mainT(language, 'backupAll'), click: () => context.onBackupAll() },
        {
          label: mainT(language, context.isPaused() ? 'resume' : 'pause'),
          click: () => context.onTogglePause(),
        },
        { type: 'separator' },
        { label: mainT(language, 'settings'), click: () => context.onOpenSettings() },
        { label: mainT(language, 'quit'), click: () => context.onQuit() },
      ]),
    )
  }

  refresh()

  return {
    refresh,
    destroy: () => tray.destroy(),
  }
}
