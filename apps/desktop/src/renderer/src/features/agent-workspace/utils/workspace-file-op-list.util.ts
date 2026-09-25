import type { FileChangeKind } from '@baishou/shared'

type FileOpTranslate = (
  key: string,
  fallback: string,
  options?: { count: number }
) => string

/** 确认前不要写成「正在写入」，避免看起来已经落盘 */
export function formatWorkspaceFileOpListTitle(
  running: boolean,
  count: number,
  t: FileOpTranslate
): string {
  if (running) {
    return t('workbench.pending_write_files', '待确认写入 {{count}} 个文件', { count })
  }
  return t('workbench.edited_files', '编辑了 {{count}} 个文件', { count })
}

export function formatFileOpActionLabel(
  t: (key: string, fallback: string) => string,
  kind: FileChangeKind,
  pending: boolean
): string {
  if (pending) {
    if (kind === 'delete') return t('file_change.kind_will_delete', '将删除')
    if (kind === 'rename') return t('file_change.kind_will_rename', '将重命名')
    if (kind === 'create') return t('file_change.kind_will_create', '将新建')
    return t('file_change.kind_will_edit', '将编辑')
  }
  if (kind === 'delete') return t('file_change.kind_delete', '删除')
  if (kind === 'rename') return t('file_change.kind_rename', '重命名')
  if (kind === 'create') return t('file_change.kind_create', '新建')
  return t('file_change.kind_edit', '编辑')
}