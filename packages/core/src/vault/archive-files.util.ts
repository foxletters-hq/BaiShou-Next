import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'

const ARCHIVE_MD = /\.md$/i

const ARCHIVE_ROOT_DIRS = ['Archives', 'Summaries'] as const

async function walkArchiveMarkdown(
  fileSystem: IFileSystem,
  dir: string,
  onMatch?: () => void
): Promise<number> {
  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(dir)
  } catch {
    return 0
  }

  let count = 0
  for (const name of entries) {
    const fullPath = path.join(dir, name)
    if (ARCHIVE_MD.test(name)) {
      count += 1
      onMatch?.()
      continue
    }
    try {
      const stat = await fileSystem.stat(fullPath)
      if (stat.isDirectory) {
        count += await walkArchiveMarkdown(fileSystem, fullPath, onMatch)
      }
    } catch {
      // skip unreadable entries
    }
  }

  return count
}

/** 统计工作区 Archives（及过渡期 Summaries）目录树中的总结 Markdown 数量 */
export async function countArchiveMarkdownInTree(
  fileSystem: IFileSystem,
  vaultPath: string
): Promise<number> {
  let count = 0
  for (const root of ARCHIVE_ROOT_DIRS) {
    const baseDir = path.join(vaultPath, root)
    if (!(await fileSystem.exists(baseDir))) continue
    count += await walkArchiveMarkdown(fileSystem, baseDir)
  }
  return count
}

/** 统计指定 Archives 根目录下的总结 Markdown 数量 */
export async function countArchiveMarkdownUnderArchivesDir(
  fileSystem: IFileSystem,
  archivesDir: string
): Promise<number> {
  if (!(await fileSystem.exists(archivesDir))) return 0
  return walkArchiveMarkdown(fileSystem, archivesDir)
}
