import { isTextDiffablePath } from '@baishou/shared'

export { isTextDiffablePath }

export function gitHistoryTotalPages(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(Math.max(totalCount, 0) / pageSize))
}

/** 提交 API 返回非空 hash 即成功；不能只用 files.length，后端曾把 files 写成空数组 */
export function interpretCommitResult(
  result: { hash?: string; files?: unknown[] } | null | undefined
): { ok: boolean; fileCount: number } {
  const hash = result?.hash?.trim()
  if (!hash) return { ok: false, fileCount: 0 }
  const fileCount = Array.isArray(result.files) ? result.files.length : 0
  return { ok: true, fileCount }
}

export function getFileStatusIcon(status: string) {
  switch (status) {
    case 'added':
      return 'A'
    case 'deleted':
      return 'D'
    case 'renamed':
      return 'R'
    default:
      return 'M'
  }
}
