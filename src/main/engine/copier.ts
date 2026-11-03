import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function sha256File(path: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

// 先写临时文件再 rename，避免备份到一半留下残缺的目标文件
export async function copyFileAtomic(sourcePath: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true })

  const temp = `${destination}.${randomUUID()}.part`
  try {
    await copyFile(sourcePath, temp)
    // 数据先落盘再 rename：rename 只改元数据，不保证数据块已写入，
    // 否则断电窗口内可能旧副本已被换掉、新副本内容为空
    const handle = await open(temp, 'r+')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temp, destination)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}
