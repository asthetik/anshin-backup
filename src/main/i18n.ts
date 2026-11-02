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
  },
  en: {
    open: 'Open Anshin',
    backupAll: 'Back up all now',
    pause: 'Pause auto-backup',
    resume: 'Resume auto-backup',
    settings: 'Settings',
    quit: 'Quit',
    tooltip: 'Anshin · Quietly watching',
  },
} as const

export type MainStringKey = keyof (typeof mainStrings)['zh']

export function mainT(language: Language, key: MainStringKey): string {
  return mainStrings[language][key]
}
