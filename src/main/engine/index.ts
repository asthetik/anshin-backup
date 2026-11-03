import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'
import type { BackupResult, EngineEvent, Source } from '../../shared/types'
import { copyFileAtomic, sha256File } from './copier'
import { AnshinDatabase, type ChangeRecord } from './db'
import { EngineError } from './errors'
import { type WatchHandle, watchSource } from './watcher'

export interface EngineOptions {
  dbPath: string
  debounceMs?: number
  watchEnabled?: boolean
  onEvent?: (event: EngineEvent) => void
}

const DEFAULT_DEBOUNCE_MS = 1000

type BackupOutcome = 'copied' | 'skipped'

export class BackupEngine {
  private readonly db: AnshinDatabase
  private readonly watchers = new Map<string, WatchHandle>()
  private readonly inFlight = new Map<string, Promise<BackupOutcome>>()
  private readonly dirty = new Set<string>()
  private readonly debounceMs: number
  private readonly watchEnabled: boolean
  private readonly onEvent: ((event: EngineEvent) => void) | undefined
  private paused = false
  private disposed = false

  constructor(options: EngineOptions) {
    this.db = new AnshinDatabase(options.dbPath)
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.watchEnabled = options.watchEnabled ?? true
    this.onEvent = options.onEvent
  }

  static async create(options: EngineOptions): Promise<BackupEngine> {
    return new BackupEngine(options)
  }

  listSources(): Source[] {
    return this.db.listSources()
  }

  getSource(sourceId: string): Source | null {
    return this.db.getSource(sourceId)
  }

  suggestDestination(sourcePath: string): string {
    return targetInFolder(sourcePath, dirname(sourcePath))
  }

  destinationInFolder(sourcePath: string, folder: string): string {
    const candidate = targetInFolder(sourcePath, folder)
    this.assertDestinationFree(candidate, { excludeSourceId: this.idForPath(sourcePath) })
    return candidate
  }

  async normalizeDestination(sourcePath: string, chosen: string): Promise<string> {
    const target = await resolveDestination(sourcePath, chosen)
    this.assertDestinationFree(target, { excludeSourceId: this.idForPath(sourcePath) })
    return target
  }

  async setDestination(sourceId: string, destination: string): Promise<Source> {
    const source = this.db.getSource(sourceId)
    if (!source) throw new Error(`Unknown source: ${sourceId}`)

    const target = await resolveDestination(source.path, destination)
    if (samePath(target, source.path)) {
      throw new EngineError('dest-same-as-source', target)
    }
    this.assertDestinationFree(target, { excludeSourceId: sourceId })

    this.db.updateDestination(sourceId, target)
    const updated = this.db.getSource(sourceId) ?? source
    this.emit({ type: 'source-updated', source: updated })

    await this.runBackup(sourceId).catch(() => undefined)
    return this.db.getSource(sourceId) ?? updated
  }

  async addSource(sourcePath: string, destination: string): Promise<Source> {
    const absolute = resolve(sourcePath)
    const info = await stat(absolute)
    if (!info.isFile()) {
      throw new EngineError('source-not-file', absolute)
    }

    const target = await resolveDestination(absolute, destination)
    if (samePath(target, absolute)) {
      throw new EngineError('dest-same-as-source', target)
    }

    const existing = this.db.findSourceByPath(absolute)
    this.assertDestinationFree(target, { excludeSourceId: existing?.id })
    if (existing) {
      if (existing.destination !== target) this.db.updateDestination(existing.id, target)
      const updated = this.db.getSource(existing.id) ?? existing
      this.startWatcher(updated)
      this.emit({ type: 'source-updated', source: updated })
      await this.runBackup(updated.id).catch(() => undefined)
      return this.db.getSource(updated.id) ?? updated
    }

    const removed = this.db.findRemovedSourceByPath(absolute)
    if (removed) {
      this.db.restoreSource(removed.id, target)
      const restored = this.db.getSource(removed.id)
      if (restored) {
        this.startWatcher(restored)
        this.emit({ type: 'source-updated', source: restored })
        await this.runBackup(restored.id).catch(() => undefined)
        return this.db.getSource(restored.id) ?? restored
      }
    }

    const source: Source = {
      id: randomUUID(),
      path: absolute,
      destination: target,
      createdAt: Date.now(),
      lastBackupAt: null,
      lastError: null,
    }

    this.db.insertSource(source)
    this.startWatcher(source)
    this.emit({ type: 'source-updated', source })

    await this.runBackup(source.id).catch(() => undefined)
    return this.db.getSource(source.id) ?? source
  }

  async removeSource(sourceId: string): Promise<void> {
    await this.stopWatcher(sourceId)
    this.dirty.delete(sourceId)
    await this.inFlight.get(sourceId)?.catch(() => undefined)
    this.db.softDeleteSource(sourceId)
    this.emit({ type: 'source-removed', sourceId })
  }

  async backupNow(sourceId: string): Promise<void> {
    if (this.disposed) return
    const source = this.db.getSource(sourceId)
    if (!source) throw new Error(`Unknown source: ${sourceId}`)
    await this.runBackup(source.id)
  }

  async backupAll(): Promise<BackupResult> {
    return this.backupMany(this.db.listSources().map((source) => source.id))
  }

  async backupMany(sourceIds: string[]): Promise<BackupResult> {
    const succeeded: string[] = []
    const skipped: string[] = []
    const failed: string[] = []

    for (const sourceId of sourceIds) {
      // 退出排干期间不再启动新的复制，没做完的留给下次启动对账
      if (this.disposed) {
        failed.push(sourceId)
        continue
      }
      if (!this.db.getSource(sourceId)) {
        failed.push(sourceId)
        continue
      }

      try {
        const outcome = await this.runBackup(sourceId)
        if (outcome === 'skipped') skipped.push(sourceId)
        else succeeded.push(sourceId)
      } catch {
        // 失败原因已经写进 Source.lastError，并通过 source-updated 推给界面
        failed.push(sourceId)
      }
    }

    return { succeeded, skipped, failed }
  }

  async removeMany(sourceIds: string[]): Promise<void> {
    for (const sourceId of sourceIds) {
      await this.removeSource(sourceId)
    }
  }

  async setDestinations(sourceIds: string[], directory: string): Promise<Source[]> {
    const dir = resolve(directory)

    // 同名文件落到同一个文件夹会互相覆盖，先拒绝
    const targets = new Set<string>()
    for (const sourceId of sourceIds) {
      const source = this.db.getSource(sourceId)
      if (!source) continue
      const target = targetInFolder(source.path, dir)
      const key = CASE_INSENSITIVE_FS ? target.toLowerCase() : target
      if (targets.has(key)) {
        throw new EngineError('duplicate-basename', basename(source.path))
      }
      targets.add(key)
    }

    const updated: Source[] = []

    for (const sourceId of sourceIds) {
      const source = this.db.getSource(sourceId)
      if (!source) continue

      const target = targetInFolder(source.path, dir)
      if (samePath(target, source.path)) continue
      this.assertDestinationFree(target, { excludeSourceId: sourceId })

      this.db.updateDestination(sourceId, target)
      const current = this.db.getSource(sourceId)
      if (current) {
        updated.push(current)
        this.emit({ type: 'source-updated', source: current })
      }

      await this.runBackup(sourceId).catch(() => undefined)
    }

    return updated
  }

  async setPaused(paused: boolean): Promise<void> {
    if (this.paused === paused) return
    this.paused = paused

    if (paused) {
      await this.stopAllWatchers()
      this.emit({ type: 'state', paused })
      return
    }

    this.startAllWatchers()
    this.emit({ type: 'state', paused })
    await this.backupAll()
  }

  isPaused(): boolean {
    return this.paused
  }

  startAllWatchers(): void {
    if (this.paused || this.disposed) return
    for (const source of this.db.listSources()) {
      this.startWatcher(source)
    }
  }

  async stopAllWatchers(): Promise<void> {
    const closes = [...this.watchers.values()].map((handle) => handle.close())
    this.watchers.clear()
    await Promise.allSettled(closes)
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.dirty.clear()
    await this.stopAllWatchers()
    await Promise.allSettled([...this.inFlight.values()])
    this.db.close()
  }

  private idForPath(sourcePath: string): string | undefined {
    return this.db.findSourceByPath(resolve(sourcePath))?.id
  }

  /** 引擎级不变量：目标不能是任何任务的源文件，也不能与其他任务的副本重合 */
  private assertDestinationFree(target: string, options: { excludeSourceId?: string } = {}): void {
    for (const source of this.db.listSources()) {
      if (samePath(source.path, target)) {
        throw new EngineError('dest-conflicts-source', target)
      }
      if (source.id !== options.excludeSourceId && samePath(source.destination, target)) {
        throw new EngineError('dest-conflicts-destination', target)
      }
    }
  }

  private startWatcher(source: Source): void {
    if (!this.watchEnabled || this.paused || this.disposed) return
    if (this.watchers.has(source.id)) return

    const handle = watchSource(source.path, {
      debounceMs: this.debounceMs,
      onChange: () => {
        if (this.paused) return
        void this.runBackup(source.id).catch((error) => {
          console.warn('[anshin] watch backup failed', error)
        })
      },
      onError: (error) => {
        console.warn('[anshin] watcher error', error)
      },
    })

    this.watchers.set(source.id, handle)
  }

  private async stopWatcher(sourceId: string): Promise<void> {
    const handle = this.watchers.get(sourceId)
    this.watchers.delete(sourceId)
    await handle?.close()
  }

  private runBackup(sourceId: string): Promise<BackupOutcome> {
    if (this.disposed) return Promise.resolve('skipped')
    const running = this.inFlight.get(sourceId)
    if (running) {
      this.dirty.add(sourceId)
      return running
    }

    const task = this.executeBackup(sourceId).finally(() => {
      this.inFlight.delete(sourceId)
      if (this.dirty.delete(sourceId) && !this.disposed) {
        void this.runBackup(sourceId).catch((error) => {
          console.warn('[anshin] catch-up backup failed', error)
        })
      }
    })

    this.inFlight.set(sourceId, task)
    return task
  }

  private async executeBackup(sourceId: string): Promise<BackupOutcome> {
    const source = this.db.getSource(sourceId)
    if (!source) return 'skipped'

    try {
      const info = await stat(source.path)
      // 源被换成目录/FIFO 等非普通文件时立刻报错，否则哈希读取会阻塞或行为未定义
      if (!info.isFile()) throw new EngineError('source-not-file', source.path)
      const destInfo = await stat(source.destination).catch(() => null)
      const record = this.db.getChangeRecord(sourceId)
      const fresh: ChangeRecord = { size: info.size, mtimeMs: info.mtimeMs, hash: null }

      // 副本在且大小一致才谈得上"无变更"：stat 快路径之后用内容哈希兜底，
      // 覆盖"文件被摸过但内容没变"的情况
      if (destInfo?.isFile() && record && destInfo.size === info.size) {
        if (record.size === info.size && record.mtimeMs === info.mtimeMs) {
          this.markVerified(sourceId, source, { ...fresh, hash: record.hash })
          return 'skipped'
        }
        const hash = await sha256File(source.path)
        if (record.hash !== null && hash === record.hash) {
          this.markVerified(sourceId, source, { ...fresh, hash: record.hash })
          return 'skipped'
        }
        await this.copyAndRecord(sourceId, source, fresh, hash)
        return 'copied'
      }

      const hash = await sha256File(source.path)
      await this.copyAndRecord(sourceId, source, fresh, hash)
      return 'copied'
    } catch (error) {
      const errno = (error as NodeJS.ErrnoException).code
      // 稳定的 errno 前缀让界面能把常见失败翻成人话，其余保留原文
      const message =
        typeof errno === 'string' && /^[A-Z]+$/.test(errno)
          ? `errno:${errno}`
          : error instanceof Error
            ? error.message
            : String(error)
      this.db.markSourceError(sourceId, message)
      const updated = this.db.getSource(sourceId)
      if (updated) this.emit({ type: 'source-updated', source: updated })
      throw error
    }
  }

  /**
   * 确认"源未变"：按源的 stat/哈希足迹判定，不读副本内容，故无法发现
   * 副本被同大小篡改这类损坏；此路径只刷新记录、清过时报错，不改 lastBackupAt
   */
  private markVerified(sourceId: string, source: Source, record: ChangeRecord): void {
    this.db.markSourceVerified(sourceId, record)
    if (source.lastError !== null) this.emitUpdated(sourceId)
  }

  /** 复制后复查源 stat：采样与落盘之间源被改写时记录的哈希不可信，置空强制下次重拷 */
  private async copyAndRecord(
    sourceId: string,
    source: Source,
    before: { size: number; mtimeMs: number },
    hash: string,
  ): Promise<void> {
    await copyFileAtomic(source.path, source.destination)
    const after = await stat(source.path).catch(() => null)
    const settled = after !== null && after.size === before.size && after.mtimeMs === before.mtimeMs
    this.db.markSourceBackup(sourceId, Date.now(), { ...before, hash: settled ? hash : null })
    this.emitUpdated(sourceId)
  }

  private emitUpdated(sourceId: string): void {
    const updated = this.db.getSource(sourceId)
    if (updated) this.emit({ type: 'source-updated', source: updated })
  }

  private emit(event: EngineEvent): void {
    this.onEvent?.(event)
  }
}

// 目标文件夹与源文件同目录时落到 backup/，避免备份覆盖源文件
function targetInFolder(sourcePath: string, folder: string): string {
  const directory = resolve(folder)
  if (directory === resolve(dirname(sourcePath))) {
    return join(directory, 'backup', basename(sourcePath))
  }
  return join(directory, basename(sourcePath))
}

// darwin/win32 的文件系统大小写不敏感，路径冲突按小写比较
const CASE_INSENSITIVE_FS = process.platform === 'win32' || process.platform === 'darwin'

function samePath(a: string, b: string): boolean {
  return CASE_INSENSITIVE_FS ? a.toLowerCase() === b.toLowerCase() : a === b
}

// 用户选的是目录（或路径以分隔符结尾）时，自动补上源文件名
async function resolveDestination(sourcePath: string, chosen: string): Promise<string> {
  const absolute = resolve(chosen)
  const looksLikeDirectory = chosen.endsWith(sep) || chosen.endsWith('/')
  if (looksLikeDirectory) return targetInFolder(sourcePath, absolute)

  const info = await stat(absolute).catch(() => null)
  if (info?.isDirectory()) return targetInFolder(sourcePath, absolute)

  return absolute
}
