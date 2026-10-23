import { describe, expect, it, vi } from 'vitest'
import { runCascadeThenTruncateSteps } from '@baishou/ai'
import type { AgentRoundCheckpoint } from '@baishou/shared'
import { waitForStreamIdleThenForceClear } from '@baishou/ai'

/**
 * 文档化 rollbackWorkspaceRound 的可测编排：
 * stop → wait idle(+force) → 选检查点 → cascade → truncate → remove
 * （不启 Electron，用 deps mock）
 */
async function runWorkspaceRollbackOrchestration(deps: {
  stopStream: (sessionId: string) => void
  waitIdle: (sessionId: string) => Promise<void>
  listUserMessageIds: () => Promise<string[]>
  loadStoreCheckpoint: (userMessageId: string) => Promise<AgentRoundCheckpoint | null>
  loadMemoryCheckpoint: (userMessageId: string) => AgentRoundCheckpoint | undefined
  persistCheckpoint: (cp: AgentRoundCheckpoint) => Promise<void>
  cascadeRollback: (checkpoints: AgentRoundCheckpoint[]) => Promise<{
    restored: string[]
    deleted: string[]
    skipped: string[]
  }>
  truncateMessages: () => Promise<void>
  removeCheckpoints: (userMessageIds: string[]) => Promise<void>
  clearInbox: () => Promise<void>
  sessionId: string
}): Promise<{ restored: string[]; deleted: string[]; skipped: string[] }> {
  deps.stopStream(deps.sessionId)
  await deps.waitIdle(deps.sessionId)

  const userMessageIds = await deps.listUserMessageIds()
  const checkpoints: AgentRoundCheckpoint[] = []
  for (const userMessageId of userMessageIds) {
    // 进程内版本不会比落盘版本旧，优先采用
    const checkpoint =
      deps.loadMemoryCheckpoint(userMessageId) ?? (await deps.loadStoreCheckpoint(userMessageId))
    if (checkpoint) {
      await deps.persistCheckpoint(checkpoint)
      checkpoints.push(checkpoint)
    }
  }

  return runCascadeThenTruncateSteps({
    cascadeRollback: async () => deps.cascadeRollback(checkpoints),
    truncateMessages: async () => {
      await deps.truncateMessages()
      await deps.clearInbox()
    },
    removeCheckpoints: async () => deps.removeCheckpoints(userMessageIds)
  })
}

describe('workspace rollback orchestration (integration-style)', () => {
  it('stop → idle → pick checkpoint → cascade → truncate/inbox → remove, in order', async () => {
    const calls: string[] = []
    const storeCp: AgentRoundCheckpoint = {
      id: 'store',
      sessionId: 's1',
      userMessageId: 'u1',
      createdAt: 't',
      files: []
    }
    // 收尾落盘之前，只有进程内的这份带着本轮的归因路径
    const memoryCp: AgentRoundCheckpoint = {
      id: 'mem',
      sessionId: 's1',
      userMessageId: 'u1',
      createdAt: 't',
      files: [{ path: 'a.ts', existed: false }],
      touchedPaths: ['a.ts']
    }

    const result = await runWorkspaceRollbackOrchestration({
      sessionId: 's1',
      stopStream: () => calls.push('stop'),
      waitIdle: async () => {
        calls.push('wait')
      },
      listUserMessageIds: async () => {
        calls.push('list')
        return ['u1', 'u2']
      },
      loadStoreCheckpoint: async (id) => (id === 'u1' ? storeCp : null),
      loadMemoryCheckpoint: (id) => (id === 'u1' ? memoryCp : undefined),
      persistCheckpoint: async (cp) => {
        calls.push(`persist:${cp.files.map((f) => f.path).join(',')}`)
      },
      cascadeRollback: async (cps) => {
        calls.push(`cascade:${cps.length}:${cps[0]?.files[0]?.path ?? ''}`)
        return { restored: [], deleted: ['a.ts'], skipped: [] }
      },
      truncateMessages: async () => {
        calls.push('truncate')
      },
      clearInbox: async () => {
        calls.push('inbox')
      },
      removeCheckpoints: async (ids) => {
        calls.push(`remove:${ids.join(',')}`)
      }
    })

    expect(calls).toEqual([
      'stop',
      'wait',
      'list',
      'persist:a.ts',
      'cascade:1:a.ts',
      'truncate',
      'inbox',
      'remove:u1,u2'
    ])
    expect(result.deleted).toEqual(['a.ts'])
  })

  it('uses waitForStreamIdleThenForceClear when marker sticks', async () => {
    const forceClear = vi.fn()
    const result = await waitForStreamIdleThenForceClear({
      sessionId: 's1',
      isStreaming: () => true,
      forceClear,
      sleep: async () => undefined,
      pollMs: 1,
      maxWaitMs: 5
    })
    expect(result.forcedClear).toBe(true)
    expect(forceClear).toHaveBeenCalledWith('s1')
  })
})
