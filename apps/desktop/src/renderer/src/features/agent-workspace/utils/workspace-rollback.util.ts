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

/** 将回滚 API 结果格式化为简短摘要（用于 toast / 对话框） */
export function formatWorkspaceRollbackSummary(
  result: WorkspaceRollbackResult,
  t: TranslateFn
): WorkspaceRollbackSummary {
  const detailLines: string[] = []

  detailLines.push(
    ...formatPathSection(
      t('round_rollback.restored_label', '已恢复：'),
      result.restored,
      (count) => t('round_rollback.more_files', '另有 {{count}} 个文件…', { count })
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
    ...formatPathSection(
      t('round_rollback.skipped_label', '已跳过：'),
      result.skipped,
      (count) => t('round_rollback.more_files', '另有 {{count}} 个文件…', { count })
    )
  )

  const touchedCount = result.restored.length + result.deleted.length
  const headline =
    touchedCount > 0
      ? t('round_rollback.success_with_counts', '已回滚本轮变更（{{restored}} 恢复，{{deleted}} 删除）', {
          restored: result.restored.length,
          deleted: result.deleted.length
        })
      : result.skipped.length > 0
        ? t('round_rollback.success_skipped_only', '已回滚本轮变更（{{count}} 个文件已跳过）', {
            count: result.skipped.length
          })
        : t('round_rollback.success', '已回滚本轮变更')

  return { headline, detailLines: detailLines.filter(Boolean) }
}
