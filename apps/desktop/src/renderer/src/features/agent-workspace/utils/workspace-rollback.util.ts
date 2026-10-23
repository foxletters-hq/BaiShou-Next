import type { WorkspaceRollbackPreview } from '@baishou/shared'

export interface WorkspaceRollbackResult {
  restored: string[]
  deleted: string[]
  skipped: string[]
}

export interface WorkspaceRollbackSummary {
  headline: string
  detailLines: string[]
}

type TranslateFn = (key: string, fallback: string, options?: Record<string, unknown>) => string

const MAX_PATH_LINES = 5

function formatPathSection(
  label: string,
  paths: string[],
  moreLabel: (count: number) => string
): string[] {
  if (paths.length === 0) return []
  const visible = paths.slice(0, MAX_PATH_LINES)
  const lines = visible.map((path) => `  · ${path}`)
  if (paths.length > MAX_PATH_LINES) {
    lines.push(`  · ${moreLabel(paths.length - MAX_PATH_LINES)}`)
  }
  return [label, ...lines]
}

export interface WorkspaceRollbackPathSection {
  label: string
  paths: string[]
  moreCount: number
}

export interface WorkspaceRollbackPreviewCopy {
  /** AI 写工具改过、必定会被还原的文件 */
  attributed: WorkspaceRollbackPathSection | null
  /** 同期变化但不是写工具造成的文件：终端命令的产物，或用户自己的编辑 */
  extra: WorkspaceRollbackPathSection | null
  /** 存在无法归因的改动时，必须让用户先选范围再回滚 */
  needsScopeChoice: boolean
  cascadeNote: string | null
  /** 没有任何文件会被改动，只会删掉对话 */
  isEmpty: boolean
}

function buildPathSection(label: string, paths: string[]): WorkspaceRollbackPathSection | null {
  if (paths.length === 0) return null
  return {
    label,
    paths: paths.slice(0, MAX_PATH_LINES),
    moreCount: Math.max(0, paths.length - MAX_PATH_LINES)
  }
}

/** 把回滚预览转成确认框要展示的文案片段 */
export function buildWorkspaceRollbackPreviewCopy(
  preview: WorkspaceRollbackPreview,
  t: TranslateFn
): WorkspaceRollbackPreviewCopy {
  return {
    attributed: buildPathSection(
      t('round_rollback.preview_files_label', '助手改过、将会撤回的文件：'),
      preview.attributedPaths
    ),
    extra: buildPathSection(
      t(
        'round_rollback.preview_extra_label',
        '下面这些文件也有变化，但不是助手直接改的（可能是命令或你自己改的）：',
        { count: preview.extraPaths.length }
      ),
      preview.extraPaths
    ),
    needsScopeChoice: preview.extraPaths.length > 0,
    cascadeNote:
      preview.rounds > 1
        ? t('round_rollback.preview_cascade', '将连同之后的 {{count}} 轮一起撤销。', {
            count: preview.rounds - 1
          })
        : null,
    isEmpty: preview.attributedPaths.length === 0 && preview.extraPaths.length === 0
  }
}

/** 将回滚 API 结果格式化为简短摘要（用于 toast / 对话框） */
export function formatWorkspaceRollbackSummary(
  result: WorkspaceRollbackResult,
  t: TranslateFn
): WorkspaceRollbackSummary {
  const detailLines: string[] = []

  detailLines.push(
    ...formatPathSection(t('round_rollback.restored_label', '已恢复：'), result.restored, (count) =>
      t('round_rollback.more_files', '另有 {{count}} 个文件…', { count })
    )
  )
  detailLines.push(
    ...formatPathSection(
      t('round_rollback.deleted_label', '已删除新建：'),
      result.deleted,
      (count) => t('round_rollback.more_files', '另有 {{count}} 个文件…', { count })
    )
  )
  detailLines.push(
    ...formatPathSection(t('round_rollback.skipped_label', '已跳过：'), result.skipped, (count) =>
      t('round_rollback.more_files', '另有 {{count}} 个文件…', { count })
    )
  )

  const touchedCount = result.restored.length + result.deleted.length
  const headline =
    touchedCount > 0
      ? t(
          'round_rollback.success_with_counts',
          '已回滚本轮变更（{{restored}} 恢复，{{deleted}} 删除）',
          {
            restored: result.restored.length,
            deleted: result.deleted.length
          }
        )
      : result.skipped.length > 0
        ? t('round_rollback.success_skipped_only', '已回滚本轮变更（{{count}} 个文件已跳过）', {
            count: result.skipped.length
          })
        : t('round_rollback.success', '已回滚本轮变更')

  return { headline, detailLines: detailLines.filter(Boolean) }
}
