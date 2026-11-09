import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parse, stringify } from 'smol-toml'
import { knownSettingsFields } from '../shared/settings'
import type { Settings } from '../shared/types'

const LEGACY_FILE = 'settings.json'

export class SettingsStore {
  private settings: Settings

  constructor(
    private readonly file: string,
    defaults: Settings,
  ) {
    let legacyFile: string | null = null
    let needsRewrite = false

    try {
      const raw = readFileSync(this.file, 'utf8')
      try {
        this.settings = { ...defaults, ...knownSettingsFields(parse(raw)) }
      } catch {
        // TOML 损坏：迁移旧版或回默认，启动时重写修复
        const legacy = this.loadLegacy(defaults)
        this.settings = legacy.settings
        legacyFile = legacy.file
        needsRewrite = true
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 文件不存在：迁移旧版 settings.json 或生成默认文件
        const legacy = this.loadLegacy(defaults)
        this.settings = legacy.settings
        legacyFile = legacy.file
        needsRewrite = true
      } else {
        // 瞬时读失败（权限/占用/句柄耗尽）：默认值进内存但不回写，
        // 不能把健康的配置文件覆盖掉；下次 update 或重启自愈
        this.settings = { ...defaults }
      }
    }

    if (needsRewrite) {
      try {
        this.persist()
        // 迁移成功后才删旧文件：先删后写会在写失败时把用户配置两头销毁
        this.removeLegacy(legacyFile)
      } catch (error) {
        console.warn('[anshin] settings rewrite failed', error)
      }
    }
  }

  get(): Settings {
    return { ...this.settings }
  }

  update(patch: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...patch }
    this.persist()
    return this.get()
  }

  // 旧版 settings.json 只在 TOML 缺失或损坏时迁移一次；只保留已知字段，
  // 旧版本遗留键（如 backupRoot）就此清理
  private loadLegacy(defaults: Settings): { settings: Settings; file: string } {
    const legacyFile = join(dirname(this.file), LEGACY_FILE)
    try {
      const parsed = JSON.parse(readFileSync(legacyFile, 'utf8')) as Record<string, unknown>
      return { settings: { ...defaults, ...knownSettingsFields(parsed) }, file: legacyFile }
    } catch {
      return { settings: { ...defaults }, file: legacyFile }
    }
  }

  private removeLegacy(legacyFile: string | null): void {
    if (!legacyFile || !existsSync(legacyFile)) return
    try {
      rmSync(legacyFile, { force: true })
    } catch (error) {
      // 删不掉（被占用等）也无妨：TOML 已生效，旧文件不会再被读取
      console.warn('[anshin] legacy settings cleanup failed', error)
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const temp = `${this.file}.tmp`
    writeFileSync(temp, stringify(this.settings), 'utf8')
    renameSync(temp, this.file)
  }
}
