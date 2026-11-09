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
    closeNoticeTitle: 'Anshin 将继续在后台运行',
    closeNoticeButton: '知道了',
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
    closeNoticeTitle: 'Anshin keeps running in the background',
    closeNoticeButton: 'Got it',
  },
} as const

export type MainStringKey = keyof (typeof mainStrings)['zh']

export function mainT(language: Language, key: MainStringKey): string {
  return mainStrings[language][key]
}
