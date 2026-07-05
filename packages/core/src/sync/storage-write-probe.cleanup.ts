import * as fs from 'fs'
import * as path from 'path'
import { isStorageWriteProbePath } from './git-sync.helpers'

const CLEANUP_SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'snapshots',
  'temp',
  '.snapshots',
  '.baishou'
])

/**
 * 删除历史版本在存储根/工作区留下的可写性探测临时文件（.write_test* / .baishou_write_test）。
 * @param maxDepth 0 = 仅存储根；1 = 再扫描一层子目录（各工作区根）
 */
export async function cleanupStorageWriteProbeFiles(
  rootDir: string,
  maxDepth = 0
): Promise<number> {
  return cleanupDir(rootDir, maxDepth, 0)
}

async function cleanupDir(dir: string, maxDepth: number, depth: number): Promise<number> {
  let removed = 0
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isFile()) {
      if (!isStorageWriteProbePath(entry.name)) continue
      try {
        await fs.promises.unlink(fullPath)
        removed++
      } catch {
        // ignore locked or already removed files
      }
      continue
    }

    if (!entry.isDirectory() || depth >= maxDepth) continue
    if (CLEANUP_SKIP_DIRS.has(entry.name)) continue
    removed += await cleanupDir(fullPath, maxDepth, depth + 1)
  }

  return removed
}

/** 删除 Git 索引中已记录的探测文件（若磁盘上仍存在） */
export async function unlinkStorageWriteProbeIfPresent(
  gitRoot: string,
  relativePath: string
): Promise<boolean> {
  if (!isStorageWriteProbePath(relativePath)) return false
  try {
    await fs.promises.unlink(path.join(gitRoot, relativePath))
    return true
  } catch {
    return false
  }
}
