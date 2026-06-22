import type { IFileSystem } from '../fs/file-system.types'
import { collectJournalPathsByDateInTree } from './journal-files.util'

export type JournalShadowResyncProbe = {
  diskCount: number
  shadowCount: number
  needsResync: boolean
  reason?: string
}

/**
 * 判断当前 Vault 是否需要全量影子索引 resync。
 * 按「唯一日历日」与影子行数对齐，避免同日期多份文件导致反复全量扫描。
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

  const { pathsByDate } = await collectJournalPathsByDateInTree(fileSystem, journalsDir)
  const uniqueDiskCount = pathsByDate.size

  if (uniqueDiskCount === 0 && shadowCount === 0) {
    return { diskCount: 0, shadowCount, needsResync: false }
  }

  if (uniqueDiskCount !== shadowCount) {
    return {
      diskCount: uniqueDiskCount,
      shadowCount,
      needsResync: true,
      reason: `count-mismatch:disk=${uniqueDiskCount},shadow=${shadowCount}`
    }
  }

  return { diskCount: uniqueDiskCount, shadowCount, needsResync: false }
}
