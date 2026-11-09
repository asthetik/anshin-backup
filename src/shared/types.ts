export type Language = 'zh' | 'en'

export interface Source {
  id: string
  path: string
  destination: string
  createdAt: number
  lastBackupAt: number | null
  lastError: string | null
}

export interface Settings {
  language: Language
  autoStart: boolean
  paused: boolean
  hideDockOnClose: boolean
  closeNoticeAcknowledged: boolean
}

export type EngineEvent =
  | { type: 'source-updated'; source: Source }
  | { type: 'source-removed'; sourceId: string }
  | { type: 'state'; paused: boolean }

export interface PickedSource {
  canceled: boolean
  path: string | null
}

/** 一次手动备份的结果；失败的条目已在对应的 Source.lastError 里带原因 */
export interface BackupResult {
  succeeded: string[]
  skipped: string[]
  failed: string[]
}

/** 引擎业务错误的稳定标识；跨 IPC 后由界面翻译成人话 */
export type EngineErrorCode =
  | 'dest-same-as-source'
  | 'dest-conflicts-source'
  | 'dest-conflicts-destination'
  | 'duplicate-basename'
  | 'source-not-file'
