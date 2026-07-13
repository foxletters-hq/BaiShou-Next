import { describe, expect, it } from 'vitest'
import { hasIncrementalSyncPlanReconfirmWorthyChange } from '@baishou/shared'

/**
 * 阶段3：规划只读 + 二次确认仅风险升级才打断（回归锚点）。
 */
describe('incremental sync plan UX guards', () => {
  it('subset shrink after replan is not reconfirm-worthy', () => {
    const previous = {
      changeCount: 5,
      items: [
        { path: 'a.md', action: 'upload' as const },
        { path: 'b.md', action: 'upload' as const },
        { path: 'c.md', action: 'download' as const },
        { path: 'd.md', action: 'upload' as const },
        { path: 'e.md', action: 'delete' as const }
      ],
      warnings: [] as string[],
      requiresHighDivergenceConfirm: false,
      deletePropagationBlocked: false
    }
    const next = {
      ...previous,
      changeCount: 4,
      items: previous.items.slice(0, 4)
    }
    expect(hasIncrementalSyncPlanReconfirmWorthyChange(previous as any, next as any)).toBe(false)
  })
})
