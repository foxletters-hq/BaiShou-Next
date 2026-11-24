import type { SessionFileService } from './session-file.service'

export interface SessionDiskFileRef {
  id: string
  fullPath?: string
  vaultName?: string
}

export interface StattedSessionDiskFile<T extends SessionDiskFileRef> {
  file: T
  size?: number
  mtimeMs?: number
}

const SESSION_STAT_CONCURRENCY = 8

/**
 * 将会话文件按「当前活跃仓库优先，其余仓库靠后」拆分为多个分区，
 * 让大库冷启动/重装恢复时先导入用户当前正在看的工作区，再处理历史工作区。
 */
export function partitionSessionFilesByActiveVault<T extends SessionDiskFileRef>(
  files: readonly T[],
  activeVaultName?: string | null
): T[][] {
  const active = activeVaultName?.trim()
  if (!active || files.length <= 1) {
    return files.length > 0 ? [[...files]] : []
  }

  const primary: T[] = []
  const secondary: T[] = []
  for (const file of files) {
    if (file.vaultName?.trim() === active) {
      primary.push(file)
    } else {
      secondary.push(file)
    }
  }

  const partitions: T[][] = []
  if (primary.length > 0) partitions.push(primary)
  if (secondary.length > 0) partitions.push(secondary)
  return partitions
}

async function readSingleSessionStat(
  fileService: SessionFileService,
  file: SessionDiskFileRef,
  needSize: boolean
): Promise<{ size?: number; mtimeMs?: number }> {
  if (typeof fileService.getSessionFileStat === 'function') {
    const stat = await fileService.getSessionFileStat(file.id, file.vaultName)
    if (stat) return stat
  }
  const [size, mtimeMs] = await Promise.all([
    needSize && typeof fileService.getSessionFileByteSize === 'function'
      ? fileService.getSessionFileByteSize(file.id, file.vaultName)
      : Promise.resolve(undefined),
    typeof fileService.getSessionFileMtimeMs === 'function'
      ? fileService.getSessionFileMtimeMs(file.id, file.vaultName)
      : Promise.resolve(undefined)
  ])
  return { size, mtimeMs }
}

/**
 * 有界并发采集单分区文件的 size/mtime，并按 mtime 降序排列（最新对话优先入库）。
 * 若部分文件取不到 mtime，则保持原顺序排在已知 mtime 文件之后。
 */
export async function statAndSortSessionFilesNewestFirst<T extends SessionDiskFileRef>(
  files: readonly T[],
  fileService: SessionFileService,
  options?: { needSize?: boolean }
): Promise<Array<StattedSessionDiskFile<T>>> {
  if (files.length === 0) return []
  const needSize = options?.needSize ?? false
  const results = new Array<{ item: StattedSessionDiskFile<T>; index: number }>(files.length)
  let cursor = 0
  const workerCount = Math.min(SESSION_STAT_CONCURRENCY, files.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < files.length) {
        const index = cursor++
        const file = files[index]!
        const stat = await readSingleSessionStat(fileService, file, needSize)
        results[index] = {
          index,
          item: { file, size: stat.size, mtimeMs: stat.mtimeMs }
        }
      }
    })
  )

  results.sort((a, b) => {
    const aTime = a.item.mtimeMs ?? -1
    const bTime = b.item.mtimeMs ?? -1
    if (aTime !== bTime) return bTime - aTime
    return a.index - b.index
  })

  return results.map((entry) => entry.item)
}
