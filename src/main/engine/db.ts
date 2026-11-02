import { DatabaseSync } from 'node:sqlite'
import type { Source } from '../../shared/types'

interface SourceRow {
  id: string
  path: string
  destination: string
  created_at: number
  last_backup_at: number | null
  last_error: string | null
  deleted_at: number | null
}

function toSource(row: SourceRow): Source {
  return {
    id: row.id,
    path: row.path,
    destination: row.destination,
    createdAt: row.created_at,
    lastBackupAt: row.last_backup_at,
    lastError: row.last_error,
  }
}

export class AnshinDatabase {
  private readonly db: DatabaseSync

  constructor(file: string) {
    this.db = new DatabaseSync(file)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.migrate()
  }

  private migrate(): void {
    // v0.1 只有单文件备份；旧的快照表与无 destination 的 sources 一并作废
    this.db.exec('DROP TABLE IF EXISTS files')
    this.db.exec('DROP TABLE IF EXISTS snapshots')

    const columns = this.db.prepare("PRAGMA table_info('sources')").all() as unknown as Array<{
      name: string
    }>
    if (columns.length > 0 && !columns.some((column) => column.name === 'destination')) {
      this.db.exec('DROP TABLE sources')
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        destination TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_backup_at INTEGER,
        last_error TEXT,
        deleted_at INTEGER
      );
    `)
  }

  listSources(): Source[] {
    const rows = this.db
      .prepare('SELECT * FROM sources WHERE deleted_at IS NULL ORDER BY created_at ASC')
      .all()
    return (rows as unknown as SourceRow[]).map(toSource)
  }

  getSource(id: string): Source | null {
    const row = this.db.prepare('SELECT * FROM sources WHERE id = ? AND deleted_at IS NULL').get(id)
    return row ? toSource(row as unknown as SourceRow) : null
  }

  findSourceByPath(path: string): Source | null {
    const row = this.db
      .prepare('SELECT * FROM sources WHERE path = ? AND deleted_at IS NULL')
      .get(path)
    return row ? toSource(row as unknown as SourceRow) : null
  }

  findRemovedSourceByPath(path: string): { id: string } | null {
    const row = this.db
      .prepare('SELECT id FROM sources WHERE path = ? AND deleted_at IS NOT NULL')
      .get(path) as { id: string } | undefined
    return row ?? null
  }

  insertSource(source: Source): void {
    this.db
      .prepare(
        `INSERT INTO sources (id, path, destination, created_at, last_backup_at, last_error)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        source.id,
        source.path,
        source.destination,
        source.createdAt,
        source.lastBackupAt,
        source.lastError,
      )
  }

  updateDestination(id: string, destination: string): void {
    this.db
      .prepare('UPDATE sources SET destination = ?, last_error = NULL WHERE id = ?')
      .run(destination, id)
  }

  restoreSource(id: string, destination: string): void {
    this.db
      .prepare(
        'UPDATE sources SET deleted_at = NULL, destination = ?, last_error = NULL WHERE id = ?',
      )
      .run(destination, id)
  }

  softDeleteSource(id: string): void {
    this.db
      .prepare('UPDATE sources SET deleted_at = ?, last_error = NULL WHERE id = ?')
      .run(Date.now(), id)
  }

  markSourceBackup(id: string, at: number): void {
    this.db
      .prepare('UPDATE sources SET last_backup_at = ?, last_error = NULL WHERE id = ?')
      .run(at, id)
  }

  markSourceError(id: string, message: string): void {
    this.db.prepare('UPDATE sources SET last_error = ? WHERE id = ?').run(message, id)
  }

  close(): void {
    this.db.close()
  }
}
