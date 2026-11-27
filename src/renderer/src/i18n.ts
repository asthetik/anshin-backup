import type { EngineErrorCode, Language } from '../../shared/types'

const strings = {
  zh: {
    addFile: '添加文件',
    files: '文件',
    settings: '设置',
    pausedLabel: '已暂停',
    runningLabel: '自动备份中',
    resume: '继续自动备份',

    backup: '立即备份',
    backingUp: '备份中…',
    backedUp: '已备份',
    backupDoneOne: '已备份 1 个文件',
    backupDone: '已备份 {n} 个文件',
    backupMixed: '已备份 {ok} 个 · {m} 个无变更',
    backupPartialMixed: '已备份 {ok} 个 · {m} 个无变更 · {n} 个失败',
    backupSkippedOne: '文件无变更，备份未覆盖',
    backupSkipped: '{n} 个文件无变更，备份未覆盖',
    backupPartial: '已备份 {ok} 个，{n} 个失败',
    backupFailedOne: '1 个文件备份失败',
    backupFailed: '{n} 个文件备份失败',
    relocate: '更改位置',
    remove: '移除',

    selectAll: '全选',
    clear: '取消选择',
    selected: '已选 {n} 项',
    backupSelected: '立即备份',
    changeFolder: '改到文件夹',
    removeSelected: '移除',

    stopAsk: '停止自动备份这个文件？',
    yesRemove: '确认移除',

    emptyTitle: '还没有要守护的文件',
    emptyBody: '加一个文件，指定一个存放位置，之后就不用管了。',
    emptyCta: '添加一个文件',

    addTitle: '添加备份',
    sourceFile: '源文件',
    destFile: '副本位置',
    choose: '选择…',
    cancel: '取消',
    add: '添加',
    destHint: '选文件夹时自动沿用源文件名',

    autoStart: '开机自动启动',
    autoStartDesc: '开机后自动在后台备份',
    hideDock: '关闭窗口时隐藏程序坞图标',
    hideDockDesc: '关闭窗口后仅保留菜单栏图标，自动备份不受影响',
    language: '语言',
    languageDesc: '切换后立即生效',
    done: '完成',

    never: '尚未备份',
    notSelected: '未选择',
    today: '今天',
    yesterday: '昨天',
    errorLine: '备份失败：{why}',
    safeCopy: '上一份副本完好',
    noticeFailed: '操作失败',

    closeAskTitle: '关闭窗口后，要继续在后台备份吗？',
    closeAskBody: '后台仍会自动备份，托盘图标随时可以打开窗口。',
    closeAskBackground: '在后台运行',
    closeAskQuit: '退出程序',

    errDestSameAsSource: '备份位置不能是源文件本身',
    errDestConflictsSource: '这个位置是另一个文件的原件，备份会把它覆盖',
    errDestConflictsDestination: '这个位置已经被另一个备份任务占用',
    errDuplicateBasename: '同名文件不能放进同一个文件夹',
    errSourceNotFile: 'Anshin v0.1 只支持备份单个文件',
    errSourceMissing: '找不到源文件，可能已被移动或删除',
    errNoAccess: '没有权限读写这个位置，请检查文件和文件夹的权限',
    errFileBusy:
      '文件正被其他程序占用，或没有访问权限。请关闭占用它的程序，或检查文件和文件夹的权限后重试',
    errDiskFull: '目标磁盘空间不足',
  },
  en: {
    addFile: 'Add file',
    files: 'Files',
    settings: 'Settings',
    pausedLabel: 'Paused',
    runningLabel: 'Auto-backup on',
    resume: 'Resume auto-backup',

    backup: 'Back up',
    backingUp: 'Backing up…',
    backedUp: 'Backed up',
    backupDoneOne: 'Backed up 1 file',
    backupDone: 'Backed up {n} files',
    backupMixed: '{ok} backed up · {m} unchanged',
    backupPartialMixed: '{ok} backed up · {m} unchanged · {n} failed',
    backupSkippedOne: 'No changes — backup left as is',
    backupSkipped: '{n} files unchanged — backups left as is',
    backupPartial: '{ok} backed up, {n} failed',
    backupFailedOne: '1 file failed to back up',
    backupFailed: '{n} files failed to back up',
    relocate: 'Change location',
    remove: 'Remove',

    selectAll: 'Select all',
    clear: 'Clear',
    selected: '{n} selected',
    backupSelected: 'Back up',
    changeFolder: 'Move to folder',
    removeSelected: 'Remove',

    stopAsk: 'Stop auto-backing up this file?',
    yesRemove: 'Remove',

    emptyTitle: 'Nothing to guard yet',
    emptyBody: 'Add a file and a place to keep it. After that you can forget about it.',
    emptyCta: 'Add a file',

    addTitle: 'Add backup',
    sourceFile: 'Source file',
    destFile: 'Copy goes to',
    choose: 'Choose…',
    cancel: 'Cancel',
    add: 'Add',
    destHint: 'Picking a folder keeps the source file name',

    autoStart: 'Launch at login',
    autoStartDesc: 'Back up automatically in the background',
    hideDock: 'Hide Dock icon when window is closed',
    hideDockDesc:
      'After closing the window, only the menu bar icon remains; backups are unaffected',
    language: 'Language',
    languageDesc: 'Applies immediately',
    done: 'Done',

    never: 'Never backed up',
    notSelected: 'Not selected',
    today: 'Today',
    yesterday: 'Yesterday',
    errorLine: 'Backup failed: {why}',
    safeCopy: 'previous copy is intact',
    noticeFailed: 'Something went wrong',

    closeAskTitle: 'Keep backing up in the background after the window closes?',
    closeAskBody:
      'Backups keep running automatically. Reopen the window any time from the tray icon.',
    closeAskBackground: 'Run in the background',
    closeAskQuit: 'Quit Anshin',

    errDestSameAsSource: 'The copy location cannot be the source file itself',
    errDestConflictsSource:
      'That location is the original of another file; backing up would overwrite it',
    errDestConflictsDestination: 'That location is already used by another backup task',
    errDuplicateBasename: 'Files with the same name cannot go into the same folder',
    errSourceNotFile: 'Anshin v0.1 backs up single files only',
    errSourceMissing: 'Cannot find the source file; it may have been moved or deleted',
    errNoAccess:
      'No permission to read or write that location; check the file and folder permissions',
    errFileBusy:
      'That file is in use by another program, or access is denied. Close the program using it, or check the file and folder permissions, then try again',
    errDiskFull: 'The destination disk is full',
  },
} as const

export type StringKey = keyof (typeof strings)['zh']

export function t(language: Language, key: StringKey): string {
  return strings[language][key]
}

const engineErrorKeys: Record<EngineErrorCode, StringKey> = {
  'dest-same-as-source': 'errDestSameAsSource',
  'dest-conflicts-source': 'errDestConflictsSource',
  'dest-conflicts-destination': 'errDestConflictsDestination',
  'duplicate-basename': 'errDuplicateBasename',
  'source-not-file': 'errSourceNotFile',
}

const errnoKeys: Record<string, StringKey> = {
  ENOENT: 'errSourceMissing',
  EACCES: 'errNoAccess',
  // Windows 上 EPERM 最常见的原因不是权限，而是目标文件被占用（杀毒软件、
  // Office 等锁住副本）；真权限问题（只读/ACL）也以 EPERM 出现，文案需
  // 同时给出「关占用程序」与「查权限」两个补救方向
  EPERM: 'errFileBusy',
  EBUSY: 'errFileBusy',
  ENOSPC: 'errDiskFull',
}

/** 引擎/IPC 传来的错误串里带稳定错误码；有码翻成人话，没码原样返回 */
export function describeError(language: Language, raw: string): string {
  for (const [code, key] of Object.entries(engineErrorKeys)) {
    if (raw.includes(code)) return t(language, key)
  }

  const errno = raw.match(/errno:([A-Z]+)/)?.[1]
  const key = errno ? errnoKeys[errno] : undefined
  if (key) return t(language, key)

  return raw
}

export function formatTemplate(
  language: Language,
  key: StringKey,
  vars: Record<string, string | number>,
): string {
  let out: string = strings[language][key]
  for (const [name, value] of Object.entries(vars)) {
    out = out.replace(`{${name}}`, String(value))
  }
  return out
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatTime(language: Language, timestamp: number | null): string {
  if (timestamp === null) return t(language, 'never')

  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const date = new Date(timestamp)
  const now = new Date()
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  if (isSameDay(date, now)) return `${t(language, 'today')} ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(date, yesterday)) return `${t(language, 'yesterday')} ${time}`

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
