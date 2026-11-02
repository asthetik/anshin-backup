import type { Language } from '../../../shared/types'

const HOME_LABEL: Record<Language, string> = {
  zh: '主文件夹',
  en: 'Home',
}

/** 文件名（路径最后一段） */
export function displayName(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) ?? filePath
}

/** 去掉文件名后的目录 */
export function parentDir(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return slash > 0 ? filePath.slice(0, slash) : ''
}

/**
 * 把绝对路径压成普通人看得懂的位置：取目录的最后两段，
 * 用户主目录本身显示成「主文件夹 / Home」，外接硬盘保留卷名。
 */
export function humanDir(dir: string, language: Language): string {
  if (!dir) return ''

  const parts = dir.split(/[\\/]/).filter(Boolean)
  if (parts.length === 0) return dir

  const homeIndex = parts.findIndex((part) => part === 'Users' || part === 'home')
  const user = homeIndex >= 0 ? parts[homeIndex + 1] : undefined

  // 目录就是主目录本身
  if (homeIndex >= 0 && parts.length === homeIndex + 2) return HOME_LABEL[language]

  const segments = parts.slice(-2).map((part) => (part === user ? HOME_LABEL[language] : part))
  return segments.join(' / ')
}

/** 一行里同时展示源位置与副本位置 */
export function humanLocation(
  sourcePath: string,
  destinationPath: string,
  language: Language,
): { source: string; target: string } {
  return {
    source: humanDir(parentDir(sourcePath), language),
    target: humanDir(parentDir(destinationPath), language),
  }
}
