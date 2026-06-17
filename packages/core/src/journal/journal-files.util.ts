import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'

const JOURNAL_DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/i

async function walkJournalsDir(
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
    if (JOURNAL_DATE_FILE.test(name)) {
      count += 1
      onMatch?.()
      continue
    }
    try {
      const stat = await fileSystem.stat(fullPath)
      if (stat.isDirectory) {
        count += await walkJournalsDir(fileSystem, fullPath, onMatch)
      }
    } catch {
      // skip unreadable entries (e.g. Unicode paths on some Android FS layers)
    }
  }

  return count
}

/**
 * 递归检查 Journals 目录下是否存在 yyyy-MM-dd.md（含 yyyy/MM/ 嵌套布局）。
 */
export async function journalMarkdownExistsInTree(
  fileSystem: IFileSystem,
  journalsDir: string
): Promise<boolean> {
  if (!(await fileSystem.exists(journalsDir))) return false
  return (await walkJournalsDir(fileSystem, journalsDir)) > 0
}

/** 统计 Journals 目录树中的日记 Markdown 文件数量 */
export async function countJournalMarkdownInTree(
  fileSystem: IFileSystem,
  journalsDir: string
): Promise<number> {
  if (!(await fileSystem.exists(journalsDir))) return 0
  return walkJournalsDir(fileSystem, journalsDir)
}
