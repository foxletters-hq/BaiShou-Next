import type { IFileSystem } from '../fs/file-system.types'
import { countJournalMarkdownInTree } from './journal-files.util'

export type JournalShadowResyncProbe = {
  diskCount: number
  shadowCount: number
  needsResync: boolean
  reason?: string
}

/**
 * 判断当前 Vault 是否需要全量影子索引 resync。
 * 不能仅凭 shadowCount > 0 认定索引完整——须与磁盘日记文件数对齐。
 */
export async function probeJournalShadowResyncNeeded(
  fileSystem: IFileSystem,
  journalsDir: string,
  shadowCount: number,
  options?: { forceResync?: boolean }
): Promise<JournalShadowResyncProbe> {
  if (options?.forceResync) {
    return {
      diskCount: -1,
      shadowCount,
      needsResync: true,
      reason: 'forced'
    }
  }

  const journalsDirExists = await fileSystem.exists(journalsDir)
  if (!journalsDirExists) {
    return {
      diskCount: 0,
      shadowCount,
      needsResync: true,
      reason: 'journals-dir-unavailable'
    }
  }

  const diskCount = await countJournalMarkdownInTree(fileSystem, journalsDir)

  if (diskCount === 0 && shadowCount === 0) {
    return { diskCount: 0, shadowCount, needsResync: false }
  }

  if (diskCount !== shadowCount) {
    return {
      diskCount,
      shadowCount,
      needsResync: true,
      reason: `count-mismatch:disk=${diskCount},shadow=${shadowCount}`
    }
  }

  return { diskCount, shadowCount, needsResync: false }
}
