import type { IncrementalSyncPlanPreview } from '../types/incremental-sync-plan.types'

function planItemKey(item: { action: string; filePath: string }): string {
  return `${item.action}:${item.filePath}`
}

function planItemFingerprint(preview: IncrementalSyncPlanPreview): string {
  return preview.items
    .map((item) => planItemKey(item))
    .sort()
    .join('|')
}

/** 确认后重新规划的结果是否与用户已阅读的预览存在实质差异（用于诊断/展示） */
export function hasIncrementalSyncPlanMaterialChange(
  before: IncrementalSyncPlanPreview,
  after: IncrementalSyncPlanPreview,
  options?: { ignoreHighDivergenceCleared?: boolean }
): boolean {
  if (before.changeCount !== after.changeCount) return true
  if (before.deletePropagationBlocked !== after.deletePropagationBlocked) return true
  if (before.requiresHighDivergenceConfirm !== after.requiresHighDivergenceConfirm) {
    const clearedOnly =
      options?.ignoreHighDivergenceCleared &&
      before.requiresHighDivergenceConfirm &&
      !after.requiresHighDivergenceConfirm
    if (!clearedOnly) return true
  }
  return planItemFingerprint(before) !== planItemFingerprint(after)
}

/**
 * 用户已点「确认同步」后，重规划是否仍需二次确认。
 * 仅在出现「升级风险」时打断：新的删除项、新的删除传播拦截、新的高差异确认。
 * 上传/下载条目减少或仅本地 mtime 漂移导致同集合规划刷新 → 直接用新规划执行。
 */
export function hasIncrementalSyncPlanReconfirmWorthyChange(
  before: IncrementalSyncPlanPreview,
  after: IncrementalSyncPlanPreview,
  options?: { ignoreHighDivergenceCleared?: boolean }
): boolean {
  if (after.deletePropagationBlocked && !before.deletePropagationBlocked) return true
  if (
    after.requiresDeletePropagationChoice &&
    !before.requiresDeletePropagationChoice &&
    !before.deletePropagationBlocked
  ) {
    return true
  }

  if (after.requiresHighDivergenceConfirm && !before.requiresHighDivergenceConfirm) return true
  if (before.requiresHighDivergenceConfirm && !after.requiresHighDivergenceConfirm) {
    const clearedOnly = Boolean(options?.ignoreHighDivergenceCleared)
    if (!clearedOnly) return true
  }

  const beforeKeys = new Set(before.items.map(planItemKey))
  for (const item of after.items) {
    const key = planItemKey(item)
    if (beforeKeys.has(key)) continue
    // 任意新增条目（含新的上传/下载/删除）都视为用户未见过的规划，需再确认
    return true
  }

  // after 是 before 的子集（条目变少或不变）：用户已确认更大范围，可直接执行
  return false
}
