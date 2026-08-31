import { isTextDiffablePath } from '@baishou/shared'

export { isTextDiffablePath }

export function gitHistoryTotalPages(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(Math.max(totalCount, 0) / pageSize))
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
