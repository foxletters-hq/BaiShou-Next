import { describe, it, expect, vi } from 'vitest'
import {
  AgentGateKind,
  AgentGateRejectedError,
  AgentGateRiskLevel,
  type AgentGateToolMetadata
} from '@baishou/shared'
import { wrapVercelToolExecuteWithAgentGate } from '../baishou-agent-gate-tool.interceptor'
import type { ToolContext } from '../../tools/agent.tool'
import type { IBaishouAgentGate } from '../baishou-agent-gate.service'

const metadata: AgentGateToolMetadata = {
  action: 'diary_write',
  riskLevel: AgentGateRiskLevel.Mutating,
  buildTitle: () => '创建日记'
}

const baseContext: ToolContext = {
  sessionId: 'sess_1',
  vaultName: 'Personal'
}

describe('wrapVercelToolExecuteWithAgentGate', () => {
  it('runs execute directly when gate is absent', async () => {
    const execute = vi.fn().mockResolvedValue('ok')
    const wrapped = wrapVercelToolExecuteWithAgentGate(
      'diary_write',
      metadata,
      baseContext,
      execute
    )

    await expect(wrapped({ date: '2026-01-01' })).resolves.toBe('ok')
    expect(execute).toHaveBeenCalledOnce()
  })

  it('calls assert before execute when gate is present', async () => {
    const assert = vi.fn().mockResolvedValue(undefined)
    const gate = { assert } as unknown as IBaishouAgentGate
    const execute = vi.fn().mockResolvedValue('done')
    const wrapped = wrapVercelToolExecuteWithAgentGate(
      'diary_write',
      metadata,
      { ...baseContext, agentGate: gate },
      execute
    )

    await expect(wrapped({ date: '2026-01-01' })).resolves.toBe('done')
    expect(assert).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess_1',
        vaultName: 'Personal',
        kind: AgentGateKind.Tool,
        action: 'diary_write',
        title: '创建日记'
      })
    )
    expect(execute).toHaveBeenCalledOnce()
  })

  it('returns gate rejection message without executing', async () => {
    const gate = {
      assert: vi.fn().mockRejectedValue(new AgentGateRejectedError())
    } as unknown as IBaishouAgentGate
    const execute = vi.fn()
    const wrapped = wrapVercelToolExecuteWithAgentGate(
      'diary_write',
      metadata,
      { ...baseContext, agentGate: gate },
      execute
    )

    const result = await wrapped({ date: '2026-01-01' })
    expect(result).toContain('拒绝')
    expect(execute).not.toHaveBeenCalled()
  })
})
