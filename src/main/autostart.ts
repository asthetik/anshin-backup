import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import { autostartExecPath, desktopEntry } from './linux'

export function applyAutoStart(enabled: boolean): void {
  // 开机自启失败不该拖垮整个应用（比如受管设备上没权限），
  // 只记日志，设置项照常生效
  try {
    if (process.platform === 'linux') {
      // XDG Autostart：开发模式下 execPath 指向 electron 本体，注册了也没意义
      if (!app.isPackaged) return

      const file = join(app.getPath('appData'), 'autostart', 'anshin.desktop')
      if (enabled) {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(
          file,
          desktopEntry('Anshin', autostartExecPath(process.env, process.execPath)),
          'utf8',
        )
      } else {
        rmSync(file, { force: true })
      }
      return
    }

    app.setLoginItemSettings({
      openAtLogin: enabled,
    })
  } catch (error) {
    log.error('设置开机自启失败', error)
  }
}
