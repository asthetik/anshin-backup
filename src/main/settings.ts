import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Settings } from '../shared/types'

export class SettingsStore {
  private settings: Settings

  constructor(
    private readonly file: string,
    defaults: Settings,
  ) {
    this.settings = this.load(defaults)
  }

  get(): Settings {
    return { ...this.settings }
  }

  update(patch: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...patch }
    this.persist()
    return this.get()
  }

  private load(defaults: Settings): Settings {
    try {
      const raw = readFileSync(this.file, 'utf8')
      return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) }
    } catch {
      return { ...defaults }
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const temp = `${this.file}.tmp`
    writeFileSync(temp, JSON.stringify(this.settings, null, 2), 'utf8')
    renameSync(temp, this.file)
  }
}
