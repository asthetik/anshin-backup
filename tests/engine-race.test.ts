import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackupEngine as Engine } from '../src/main/engine'

vi.mock('../src/main/engine/copier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/main/engine/copier')>()
  const { utimes, writeFile: write } = await import('node:fs/promises')
  let copies = 0
  return {
    ...actual,
    // 第二次复制时模拟竞态：哈希采样后、复制落盘前源被同大小改写。
    // 显式推进 mtime：文件系统时间精度可能使改写与采样落入同一刻度，
    // 「复制后复查」因此误判为 settled，导致该测试在 Windows CI 上间歇性失败
    copyFileAtomic: async (source: string, destination: string) => {
      copies += 1
      if (copies === 2) {
        await write(source, 'v9')
        const bumped = new Date(Date.now() + 10_000)
        await utimes(source, bumped, bumped)
      }
      await actual.copyFileAtomic(source, destination)
    },
  }
})

const { BackupEngine } = await import('../src/main/engine')

let workspace: string | null = null
let engine: Engine | null = null

async function setup() {
  workspace = await mkdtemp(join(tmpdir(), 'anshin-test-'))
  engine = await BackupEngine.create({
    dbPath: join(workspace, 'anshin.db'),
    watchEnabled: false,
  })
  return { workspace }
}

afterEach(async () => {
  await engine?.dispose()
  engine = null
  if (workspace) await rm(workspace, { recursive: true, force: true })
  workspace = null
})

describe('BackupEngine copy-window race', () => {
  it('recopies when the source was rewritten between sampling and copy', async () => {
    const { workspace } = await setup()
    const source = join(workspace, 'race.txt')
    const target = join(workspace, 'backup', 'race.txt')
    await writeFile(source, 'v1')

    const added = await engine?.addSource(source, target)
    expect(await readFile(target, 'utf8')).toBe('v1')

    await writeFile(source, 'v2')
    // 复制路径中 mock 把源同大小改写成 v9 后再复制：副本= v9，但采样到的哈希是 v2 的
    const first = await engine?.backupMany([added?.id ?? ''])
    expect(first?.succeeded).toEqual([added?.id])
    expect(await readFile(target, 'utf8')).toBe('v9')

    // 内容随后恢复成 v2（撤销/还原）：哈希与记录一致，但副本实际是 v9，必须重拷
    await writeFile(source, 'v2')
    const second = await engine?.backupMany([added?.id ?? ''])

    expect(second?.succeeded).toEqual([added?.id])
    expect(await readFile(target, 'utf8')).toBe('v2')
  })
})
