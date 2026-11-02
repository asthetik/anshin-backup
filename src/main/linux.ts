// Linux 桌面集成所需的纯逻辑，不依赖 Electron，便于测试

// 托盘图标确定可见的桌面环境；GNOME 默认没有系统托盘，
// elementary/Pantheon 刻意不实现托盘，同样不能驻留
// X-Cinnamon 是 Cinnamon 实际写入 XDG_CURRENT_DESKTOP 的段名
const TRAY_DESKTOPS = new Set([
  'kde',
  'xfce',
  'mate',
  'cinnamon',
  'x-cinnamon',
  'lxqt',
  'budgie',
  'deepin',
  'ukui',
  'unity',
])

/**
 * 关窗时是否驻留托盘。macOS/Windows 恒为 true；
 * Linux 只在托盘确定可见的桌面驻留，其余（GNOME/未知）关窗即退出，
 * 否则窗口一关应用就再也唤不回来。
 */
export function hideToTrayOnClose(platform: NodeJS.Platform, desktop: string | undefined): boolean {
  if (platform !== 'linux') return true
  if (!desktop) return false

  return desktop
    .split(':')
    .map((segment) => segment.trim().toLowerCase())
    .some((segment) => TRAY_DESKTOPS.has(segment))
}

/**
 * 自启要写的可执行路径。AppImage 运行时 process.execPath 指向 /tmp/.mount_* 临时
 * FUSE 挂载点，退出即失效；AppImage runtime 会把真实 .AppImage 文件路径放进
 * APPIMAGE 环境变量，优先用它，deb 等安装形态回落 execPath。
 */
export function autostartExecPath(env: NodeJS.ProcessEnv, execPath: string): string {
  const appImage = env.APPIMAGE
  return typeof appImage === 'string' && appImage.length > 0 ? appImage : execPath
}

/** XDG Autostart 的 .desktop 内容；Exec 按规范整体加引号并转义保留字符 */
export function desktopEntry(name: string, execPath: string): string {
  // 换行等控制字符会截断 Exec 行，写出去就是一条解析失败的坏条目
  const hasControl = [...execPath].some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code < 0x20 || code === 0x7f
  })
  if (hasControl) {
    throw new Error(`exec path contains control characters: ${JSON.stringify(execPath)}`)
  }

  // 引号内 " ` $ \ 四个字符按 Desktop Entry 规范都要转义；
  // 新版 GLib 严格校验，缺一个整条 Exec 会被拒收。
  // 字面 % 要写成 %%，否则会被当作 %f 之类的字段码展开
  const escaped = execPath.replace(/(["`$\\])/g, '\\$1').replace(/%/g, '%%')
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${name}`,
    `Exec="${escaped}"`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n')
}
