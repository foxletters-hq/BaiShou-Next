import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'

const JOURNAL_DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/i

/**
 * 递归检查 Journals 目录下是否存在 yyyy-MM-dd.md（含 yyyy/MM/ 嵌套布局）。
 */
export async function journalMarkdownExistsInTree(
  fileSystem: IFileSystem,
  journalsDir: string
): Promise<boolean> {
  if (!(await fileSystem.exists(journalsDir))) return false
  return walkJournalsDir(fileSystem, journalsDir)
}

async function walkJournalsDir(fileSystem: IFileSystem, dir: string): Promise<boolean> {
  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(dir)
  } catch {
    return false
  }

  for (const name of entries) {
    const fullPath = path.join(dir, name)
    if (JOURNAL_DATE_FILE.test(name)) {
      return true
    }
    try {
      const stat = await fileSystem.stat(fullPath)
      if (stat.isDirectory && (await walkJournalsDir(fileSystem, fullPath))) {
        return true
      }
    } catch {
      // skip unreadable entries
    }
  }

  return false
}
