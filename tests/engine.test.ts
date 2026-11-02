import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BackupEngine } from '../src/main/engine'

let workspace: string | null = null
let engine: BackupEngine | null = null

async function setup(options: { watch?: boolean } = {}) {
  workspace = await mkdtemp(join(tmpdir(), 'anshin-test-'))

  engine = await BackupEngine.create({
    dbPath: join(workspace, 'anshin.db'),
    watchEnabled: options.watch ?? false,
    debounceMs: 10,
  })

  return { workspace }
}

const caseInsensitiveFs = process.platform === 'darwin' || process.platform === 'win32'

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('timed out waiting for a condition')
}

afterEach(async () => {
  await engine?.dispose()
  engine = null
  if (workspace) await rm(workspace, { recursive: true, force: true })
  workspace = null
})

describe('BackupEngine', () => {
  it('copies a file to an explicit destination path', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'demo.txt')
    const target = join(workspace, 'backup', 'demo.txt')
    await writeFile(source, 'hello')

    const added = await engine?.addSource(source, target)

    expect(added?.destination).toBe(target)
    expect(await readFile(target, 'utf8')).toBe('hello')
    expect(added?.lastBackupAt).not.toBeNull()
  })

  it('appends the file name when the destination is a directory', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'demo.txt')
    const directory = join(workspace, 'backup')
    await writeFile(source, 'hello')
    await mkdir(directory, { recursive: true })

    const added = await engine?.addSource(source, directory)

    expect(added?.destination).toBe(join(directory, 'demo.txt'))
    expect(await readFile(join(directory, 'demo.txt'), 'utf8')).toBe('hello')
  })

  it('overwrites the destination when the source changes', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'note.txt')
    const target = join(workspace, 'backup', 'note.txt')
    await writeFile(source, 'v1')

    const added = await engine?.addSource(source, target)
    await writeFile(source, 'v2')
    await engine?.backupNow(added?.id ?? '')

    expect(await readFile(target, 'utf8')).toBe('v2')
  })

  it('keeps the copied file after the source is removed', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'keep.txt')
    const target = join(workspace, 'backup', 'keep.txt')
    await writeFile(source, 'keep me')

    const added = await engine?.addSource(source, target)
    await engine?.removeSource(added?.id ?? '')

    expect(engine?.listSources()).toHaveLength(0)
    expect(await readFile(target, 'utf8')).toBe('keep me')
  })

  it('restores the same id when a removed file is added again', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'again.txt')
    const target = join(workspace, 'backup', 'again.txt')
    await writeFile(source, 'data')

    const added = await engine?.addSource(source, target)
    await engine?.removeSource(added?.id ?? '')
    const readded = await engine?.addSource(source, target)

    expect(readded?.id).toBe(added?.id)
    expect(engine?.listSources()).toHaveLength(1)
  })

  it('rejects a destination that is the source file itself', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'self.txt')
    await writeFile(source, 'data')

    await expect(engine?.addSource(source, source)).rejects.toThrow()
    expect(await readFile(source, 'utf8')).toBe('data')
  })

  it('records an error and leaves the old copy when the source disappears', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'gone.txt')
    const target = join(workspace, 'backup', 'gone.txt')
    await writeFile(source, 'v1')

    const added = await engine?.addSource(source, target)
    await rm(source)
    await engine?.backupNow(added?.id ?? '').catch(() => undefined)

    expect(await readFile(target, 'utf8')).toBe('v1')
    const current = engine?.listSources().find((item) => item.id === added?.id)
    expect(current?.lastError).toBeTruthy()
  })

  it('moves the copy when the destination changes', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'move.txt')
    const first = join(workspace, 'a', 'move.txt')
    const second = join(workspace, 'b', 'move.txt')
    await writeFile(source, 'data')

    const added = await engine?.addSource(source, first)
    const updated = await engine?.setDestination(added?.id ?? '', second)

    expect(updated?.destination).toBe(second)
    expect(await readFile(second, 'utf8')).toBe('data')
  })

  it('appends the file name when the new destination is a directory', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'move.txt')
    const first = join(workspace, 'a', 'move.txt')
    const directory = join(workspace, 'b')
    await writeFile(source, 'data')
    await mkdir(directory, { recursive: true })

    const added = await engine?.addSource(source, first)
    const updated = await engine?.setDestination(added?.id ?? '', directory)

    expect(updated?.destination).toBe(join(directory, 'move.txt'))
    expect(await readFile(join(directory, 'move.txt'), 'utf8')).toBe('data')
  })

  it('rejects a new destination that is the source file itself', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'self.txt')
    const first = join(workspace, 'backup', 'self.txt')
    await writeFile(source, 'data')

    const added = await engine?.addSource(source, first)

    await expect(engine?.setDestination(added?.id ?? '', source)).rejects.toThrow()
    expect(await readFile(first, 'utf8')).toBe('data')
  })

  it('honors an explicit destination file name', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'demo.txt')
    const target = join(workspace, 'backup', 'renamed-copy.txt')
    await writeFile(source, 'hello')

    const added = await engine?.addSource(source, target)

    expect(added?.destination).toBe(target)
    expect(await readFile(target, 'utf8')).toBe('hello')
  })

  it('uses a backup subfolder when the chosen folder is the source folder', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'demo.txt')
    await writeFile(source, 'hello')

    const added = await engine?.addSource(source, workspace)

    expect(added?.destination).toBe(join(workspace, 'backup', 'demo.txt'))
    expect(await readFile(join(workspace, 'backup', 'demo.txt'), 'utf8')).toBe('hello')
  })

  it('backs up several files in one call', async () => {
    const { workspace } = await setup()
    const first = join(workspace, 'one.txt')
    const second = join(workspace, 'two.txt')
    const firstTarget = join(workspace, 'backup', 'one.txt')
    const secondTarget = join(workspace, 'backup', 'two.txt')
    await writeFile(first, 'one')
    await writeFile(second, 'two')

    const a = await engine?.addSource(first, firstTarget)
    const b = await engine?.addSource(second, secondTarget)

    await writeFile(first, 'one updated')
    await writeFile(second, 'two updated')
    const result = await engine?.backupMany([a?.id ?? '', b?.id ?? ''])

    expect(result?.succeeded).toEqual([a?.id, b?.id])
    expect(result?.failed).toEqual([])
    expect(await readFile(firstTarget, 'utf8')).toBe('one updated')
    expect(await readFile(secondTarget, 'utf8')).toBe('two updated')
  })

  it('reports which file failed in a batch', async () => {
    const { workspace } = await setup()
    const good = join(workspace, 'good.txt')
    const gone = join(workspace, 'gone.txt')
    const goodTarget = join(workspace, 'backup', 'good.txt')
    const goneTarget = join(workspace, 'backup', 'gone.txt')
    await writeFile(good, 'good')
    await writeFile(gone, 'gone')

    const ok = await engine?.addSource(good, goodTarget)
    const missing = await engine?.addSource(gone, goneTarget)

    await rm(gone)
    const result = await engine?.backupMany([missing?.id ?? '', ok?.id ?? ''])

    expect(result?.succeeded).toEqual([ok?.id])
    expect(result?.failed).toEqual([missing?.id])
    expect(await readFile(goodTarget, 'utf8')).toBe('good')
    expect(engine?.listSources().find((item) => item.id === missing?.id)?.lastError).toBeTruthy()
  })

  it('sends selected files into one folder', async () => {
    const { workspace } = await setup()
    const first = join(workspace, 'one.txt')
    const second = join(workspace, 'two.txt')
    const folder = join(workspace, 'batch')
    await writeFile(first, 'one')
    await writeFile(second, 'two')
    await mkdir(folder, { recursive: true })

    const a = await engine?.addSource(first, join(workspace, 'old', 'one.txt'))
    const b = await engine?.addSource(second, join(workspace, 'old', 'two.txt'))

    const updated = await engine?.setDestinations([a?.id ?? '', b?.id ?? ''], folder)

    expect(updated).toHaveLength(2)
    expect(await readFile(join(folder, 'one.txt'), 'utf8')).toBe('one')
    expect(await readFile(join(folder, 'two.txt'), 'utf8')).toBe('two')
  })

  it('refuses a batch destination that would collide', async () => {
    const { workspace } = await setup()
    const firstDir = join(workspace, 'a')
    const secondDir = join(workspace, 'b')
    const folder = join(workspace, 'batch')
    await mkdir(firstDir, { recursive: true })
    await mkdir(secondDir, { recursive: true })
    await mkdir(folder, { recursive: true })

    const first = join(firstDir, 'same.txt')
    const second = join(secondDir, 'same.txt')
    await writeFile(first, 'one')
    await writeFile(second, 'two')

    const a = await engine?.addSource(first, join(workspace, 'old', 'a.txt'))
    const b = await engine?.addSource(second, join(workspace, 'old', 'b.txt'))

    await expect(engine?.setDestinations([a?.id ?? '', b?.id ?? ''], folder)).rejects.toThrow()
  })

  it('removes several sources at once', async () => {
    const { workspace } = await setup()
    const first = join(workspace, 'one.txt')
    const second = join(workspace, 'two.txt')
    await writeFile(first, 'one')
    await writeFile(second, 'two')

    const a = await engine?.addSource(first, join(workspace, 'backup', 'one.txt'))
    const b = await engine?.addSource(second, join(workspace, 'backup', 'two.txt'))

    await engine?.removeMany([a?.id ?? '', b?.id ?? ''])

    expect(engine?.listSources()).toHaveLength(0)
  })

  it('does not watch when watching is disabled', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'quiet.txt')
    const target = join(workspace, 'backup', 'quiet.txt')
    await writeFile(source, 'v1')

    await engine?.addSource(source, target)
    await writeFile(source, 'v2')
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(await readFile(target, 'utf8')).toBe('v1')
  })

  it('rejects a destination that would overwrite the source file of another task', async () => {
    const { workspace } = await setup()
    const dirA = join(workspace, 'a')
    const dirB = join(workspace, 'b')
    await mkdir(dirA, { recursive: true })
    await mkdir(dirB, { recursive: true })
    await writeFile(join(dirA, 'same.txt'), 'original')
    await writeFile(join(dirB, 'same.txt'), 'intruder')

    await engine?.addSource(join(dirA, 'same.txt'), join(workspace, 'safe', 'same.txt'))

    await expect(engine?.addSource(join(dirB, 'same.txt'), dirA)).rejects.toMatchObject({
      code: 'dest-conflicts-source',
    })
    expect(await readFile(join(dirA, 'same.txt'), 'utf8')).toBe('original')
  })

  it('rejects a destination that collides with the copy of another task', async () => {
    const { workspace } = await setup()
    const dirA = join(workspace, 'a')
    const dirB = join(workspace, 'b')
    const folder = join(workspace, 'copies')
    await mkdir(dirA, { recursive: true })
    await mkdir(dirB, { recursive: true })
    await mkdir(folder, { recursive: true })
    await writeFile(join(dirA, 'same.txt'), 'one')
    await writeFile(join(dirB, 'same.txt'), 'two')

    await engine?.addSource(join(dirA, 'same.txt'), folder)

    await expect(engine?.addSource(join(dirB, 'same.txt'), folder)).rejects.toMatchObject({
      code: 'dest-conflicts-destination',
    })
  })

  it.skipIf(!caseInsensitiveFs)(
    'rejects a case-variant collision with the source of another task',
    async () => {
      const { workspace } = await setup()
      const dirA = join(workspace, 'a')
      const dirB = join(workspace, 'b')
      await mkdir(dirA, { recursive: true })
      await mkdir(dirB, { recursive: true })
      await writeFile(join(dirA, 'Same.txt'), 'original')
      await writeFile(join(dirB, 'same.TXT'), 'intruder')

      await engine?.addSource(join(dirA, 'Same.txt'), join(workspace, 'safe', 'same.txt'))

      await expect(engine?.addSource(join(dirB, 'same.TXT'), dirA)).rejects.toMatchObject({
        code: 'dest-conflicts-source',
      })
      expect(await readFile(join(dirA, 'Same.txt'), 'utf8')).toBe('original')
    },
  )

  it('rejects a relocation onto the source file of another task', async () => {
    const { workspace } = await setup()
    const first = join(workspace, 'a', 'first.txt')
    const second = join(workspace, 'b', 'second.txt')
    await mkdir(join(workspace, 'a'), { recursive: true })
    await mkdir(join(workspace, 'b'), { recursive: true })
    await writeFile(first, 'original')
    await writeFile(second, 'intruder')

    await engine?.addSource(first, join(workspace, 'safe', 'first.txt'))
    const moved = await engine?.addSource(second, join(workspace, 'safe', 'second.txt'))

    await expect(engine?.setDestination(moved?.id ?? '', first)).rejects.toMatchObject({
      code: 'dest-conflicts-source',
    })
    expect(await readFile(first, 'utf8')).toBe('original')
  })

  it('rejects a non-file source with a stable code', async () => {
    const { workspace } = await setup()
    const directory = join(workspace, 'folder')
    await mkdir(directory, { recursive: true })

    await expect(engine?.addSource(directory, join(workspace, 'out.txt'))).rejects.toMatchObject({
      code: 'source-not-file',
    })
  })

  it('records an errno code when the copy fails', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'gone.txt')
    const target = join(workspace, 'backup', 'gone.txt')
    await writeFile(source, 'v1')

    const added = await engine?.addSource(source, target)
    await rm(source)
    await engine?.backupNow(added?.id ?? '').catch(() => undefined)

    const current = engine?.listSources().find((item) => item.id === added?.id)
    expect(current?.lastError).toMatch(/^errno:[A-Z]+$/)
  })

  it('ignores backup requests after dispose', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'after.txt')
    const target = join(workspace, 'backup', 'after.txt')
    await writeFile(source, 'v2')

    const added = await engine?.addSource(source, target)
    await rm(target)
    await engine?.dispose()

    // 退出排干期间不该再启动新的复制;没做完的留给下次启动对账
    await expect(engine?.backupNow(added?.id ?? '')).resolves.toBeUndefined()
    await expect(readFile(target)).rejects.toThrow()
  })

  it('backs up automatically when the source changes', async () => {
    const { workspace } = await setup({ watch: true })
    const source = join(workspace, 'live.txt')
    const target = join(workspace, 'backup', 'live.txt')
    await writeFile(source, 'v1')

    await engine?.addSource(source, target)
    expect(await readFile(target, 'utf8')).toBe('v1')

    await writeFile(source, 'v2')
    await waitUntil(async () => (await readFile(target, 'utf8')) === 'v2')

    await rm(source)
    await writeFile(source, 'v3')
    await waitUntil(async () => (await readFile(target, 'utf8')) === 'v3')
  })
})
