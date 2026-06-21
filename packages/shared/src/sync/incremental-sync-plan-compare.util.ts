import type { IncrementalSyncPlanPreview } from '../types/incremental-sync-plan.types'

function planItemFingerprint(preview: IncrementalSyncPlanPreview): string {
  return preview.items
    .map((item) => `${item.action}:${item.filePath}`)
    .sort()
    .join('|')
}

/** 确认后重新规划的结果是否与用户已阅读的预览存在实质差异 */
export function hasIncrementalSyncPlanMaterialChange(
  before: IncrementalSyncPlanPreview,
  after: IncrementalSyncPlanPreview
): boolean {
  if (before.changeCount !== after.changeCount) return true
  if (before.deletePropagationBlocked !== after.deletePropagationBlocked) return true
  if (before.requiresHighDivergenceConfirm !== after.requiresHighDivergenceConfirm) return true
  return planItemFingerprint(before) !== planItemFingerprint(after)
}
