import type { MergeDecision } from '@baishou/shared'

/** 同步任务按体积升序（小文件先完成，进度更平滑）；同体积按路径稳定排序 */
export function sortSyncDecisionsBySizeAsc(decisions: MergeDecision[]): MergeDecision[] {
  return [...decisions].sort((a, b) => {
    const sizeA = a.size ?? 0
    const sizeB = b.size ?? 0
    if (sizeA !== sizeB) return sizeA - sizeB
    return a.filePath.localeCompare(b.filePath, 'zh-CN')
  })
}
