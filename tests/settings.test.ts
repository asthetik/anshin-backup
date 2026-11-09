import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsStore } from '../src/main/settings'
import type { Settings } from '../src/shared/types'

const defaults = (): Settings => ({
  language: 'zh',
  autoStart: false,
  paused: false,
  hideDockOnClose: false,
  closeNoticeAcknowledged: false,
})

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'anshin-settings-'))

afterEach(() => {
  // mkdtemp 目录留在系统临时目录，由操作系统清理
})

describe('SettingsStore (TOML)', () => {
  it('creates the settings file with defaults when missing', () => {
    const dir = tempDir()
    const file = join(dir, 'settings.toml')
    const store = new SettingsStore(file, defaults())

    expect(existsSync(file)).toBe(true)
    const onDisk = parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    expect(onDisk.language).toBe('zh')
    expect(onDisk.hideDockOnClose).toBe(false)
    expect(store.get()).toEqual(defaults())
  })

  it('persists updates and reads them back in a new instance', () => {
    const dir = tempDir()
    const file = join(dir, 'settings.toml')
    new SettingsStore(file, defaults()).update({ hideDockOnClose: true, language: 'en' })

    const reopened = new SettingsStore(file, defaults()).get()
    expect(reopened.hideDockOnClose).toBe(true)
    expect(reopened.language).toBe('en')
  })

  it('migrates legacy settings.json once and prunes unknown keys', () => {
    const dir = tempDir()
    const file = join(dir, 'settings.toml')
    const legacy = join(dir, 'settings.json')
    writeFileSync(
      legacy,
      JSON.stringify({
        language: 'en',
        autoStart: true,
        paused: false,
        backupRoot: '/legacy/path',
      }),
      'utf8',
    )

    const store = new SettingsStore(file, defaults())

    expect(store.get().language).toBe('en')
    expect(store.get().autoStart).toBe(true)
    const onDisk = parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    expect(onDisk.backupRoot).toBeUndefined()
    expect(existsSync(legacy)).toBe(false)
  })

  it('falls back to defaults on a corrupt TOML file and rewrites it valid', () => {
    const dir = tempDir()
    const file = join(dir, 'settings.toml')
    writeFileSync(file, 'language = [broken', 'utf8')

    const store = new SettingsStore(file, defaults())

    expect(store.get()).toEqual(defaults())
    const onDisk = parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    expect(onDisk.language).toBe('zh')
  })

  it('recovers from a corrupt TOML via a valid legacy settings.json', () => {
    const dir = tempDir()
    const file = join(dir, 'settings.toml')
    writeFileSync(file, 'language = [broken', 'utf8')
    const legacy = join(dir, 'settings.json')
    writeFileSync(legacy, JSON.stringify({ language: 'en', autoStart: true }), 'utf8')

    const store = new SettingsStore(file, defaults())

    expect(store.get().language).toBe('en')
    expect(store.get().autoStart).toBe(true)
    expect(existsSync(legacy)).toBe(false)
    const onDisk = parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    expect(onDisk.language).toBe('en')
  })

  it('leaves a healthy TOML file byte-identical on startup', () => {
    const dir = tempDir()
    const file = join(dir, 'settings.toml')
    const handEdited = '# hand-edited comment\nlanguage = "en"\nautoStart = true\n'
    writeFileSync(file, handEdited, 'utf8')

    const store = new SettingsStore(file, defaults())

    expect(store.get().language).toBe('en')
    expect(readFileSync(file, 'utf8')).toBe(handEdited)
  })

  it.skipIf(process.platform === 'win32')(
    'keeps the file intact when reading fails for transient reasons',
    () => {
      const dir = tempDir()
      const file = join(dir, 'settings.toml')
      const healthy = 'language = "en"\nautoStart = true\n'
      writeFileSync(file, healthy, 'utf8')
      chmodSync(file, 0o000)

      let store: SettingsStore
      try {
        store = new SettingsStore(file, defaults())
      } finally {
        chmodSync(file, 0o644)
      }

      // 内存里跑默认值，但不把读不了的文件覆盖掉
      expect(store.get().language).toBe('zh')
      expect(readFileSync(file, 'utf8')).toBe(healthy)
    },
  )

  it('drops an invalid language value instead of accepting it', () => {
    const dir = tempDir()
    const file = join(dir, 'settings.toml')
    writeFileSync(file, 'language = "fr"\nautoStart = true', 'utf8')

    const store = new SettingsStore(file, defaults())

    expect(store.get().language).toBe('zh')
    expect(store.get().autoStart).toBe(true)
  })
})
