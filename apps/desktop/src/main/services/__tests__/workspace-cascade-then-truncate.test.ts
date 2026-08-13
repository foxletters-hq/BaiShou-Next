import { describe, expect, it, vi } from 'vitest'
import { runCascadeThenTruncateSteps } from '@baishou/ai'

/**
 * 文档化主进程 rollbackWorkspaceRound 的磁盘→截断顺序：
 * cascadeRollback → truncateMessages → removeCheckpoints
 * （避免重 Electron 集成，仅测可注入步骤编排）
 */
describe('runCascadeThenTruncateSteps', () => {
  it('runs cascade before truncate before removeCheckpoints', async () => {
    const calls: string[] = []
    const result = await runCascadeThenTruncateSteps({
      cascadeRollback: async () => {
        calls.push('cascade')
        return { restored: ['a.ts'], deleted: [], skipped: [] }
      },
      truncateMessages: async () => {
        calls.push('truncate')
      },
      removeCheckpoints: async () => {
        calls.push('removeCheckpoints')
      }
    })

    expect(calls).toEqual(['cascade', 'truncate', 'removeCheckpoints'])
    expect(result).toEqual({ restored: ['a.ts'], deleted: [], skipped: [] })
  })

  it('does not truncate if cascade throws', async () => {
    const truncateMessages = vi.fn()
    const removeCheckpoints = vi.fn()

    await expect(
      runCascadeThenTruncateSteps({
        cascadeRollback: async () => {
          throw new Error('disk fail')
        },
        truncateMessages,
        removeCheckpoints
      })
    ).rejects.toThrow('disk fail')

    expect(truncateMessages).not.toHaveBeenCalled()
    expect(removeCheckpoints).not.toHaveBeenCalled()
  })
})
