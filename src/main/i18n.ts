import type { Language } from '../shared/types'

const mainStrings = {
  zh: {
    open: '打开 Anshin',
    backupAll: '立即备份全部',
    pause: '暂停自动备份',
    resume: '继续自动备份',
    settings: '设置',
    quit: '退出',
    tooltip: 'Anshin · 默然守护',
    dockChoiceTitle: '关闭窗口时隐藏程序坞图标？',
    dockChoiceKeep: '保留',
    dockChoiceHide: '隐藏',
    closeAskTitle: '关闭窗口后，要继续在后台备份吗？',
    closeAskBody: '后台仍会自动备份，托盘图标随时可以打开窗口。',
    closeAskBackground: '在后台运行',
    closeAskQuit: '退出程序',
  },
  en: {
    open: 'Open Anshin',
    backupAll: 'Back up all now',
    pause: 'Pause auto-backup',
    resume: 'Resume auto-backup',
    settings: 'Settings',
    quit: 'Quit',
    tooltip: 'Anshin · Quietly watching',
    dockChoiceTitle: 'Hide the Dock icon when closing the window?',
    dockChoiceKeep: 'Keep',
    dockChoiceHide: 'Hide',
    closeAskTitle: 'Keep backing up in the background after the window closes?',
    closeAskBody:
      'Backups keep running automatically. Reopen the window any time from the tray icon.',
    closeAskBackground: 'Run in the background',
    closeAskQuit: 'Quit Anshin',
  },
} as const

export type MainStringKey = keyof (typeof mainStrings)['zh']

export function mainT(language: Language, key: MainStringKey): string {
  return mainStrings[language][key]
}
