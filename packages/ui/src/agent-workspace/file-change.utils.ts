import type { FileChangeKind } from '@baishou/shared'

export function formatFileChangeStats(additions: number, deletions: number): string {
  const parts: string[] = []
  if (additions > 0) parts.push(`+${additions}`)
  if (deletions > 0) parts.push(`-${deletions}`)
  return parts.length > 0 ? parts.join(' ') : '0'
}

export function fileChangeKindLabel(
  t: (key: string, fallback: string) => string,
  kind: FileChangeKind
): string {
  switch (kind) {
    case 'create':
      return t('file_change.kind_create', '新建')
    case 'modify':
      return t('file_change.kind_modify', '修改')
    case 'delete':
      return t('file_change.kind_delete', '删除')
    case 'rename':
      return t('file_change.kind_rename', '重命名')
    default:
      return kind
  }
}

export function basenameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? filePath
}
