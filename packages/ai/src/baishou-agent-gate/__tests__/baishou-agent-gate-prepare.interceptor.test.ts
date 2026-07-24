import { describe, expect, it, vi } from 'vitest'
import { AgentGateKind, AgentGateRiskLevel, type AgentGateToolMetadata } from '@baishou/shared'
import { wrapVercelToolExecuteWithAgentGate } from '../baishou-agent-gate-tool.interceptor'
import type { ToolContext } from '../../tools/agent.tool'
import type { IBaishouAgentGate } from '../baishou-agent-gate.service'

describe('wrapVercelToolExecuteWithAgentGate prepare', () => {
  const baseContext: ToolContext = {
    sessionId: 'sess_1',
    vaultName: 'Personal'
  }

  it('does not ask when prepare returns null', async () => {
    const assert = vi.fn()
    const execute = vi.fn()
    const metadata: AgentGateToolMetadata = {
      action: 'workspace_patch',
      riskLevel: AgentGateRiskLevel.Mutating,
      prepare: async () => null
    }
    const wrapped = wrapVercelToolExecuteWithAgentGate(
      'workspace_patch',
      metadata,
      { ...baseContext, agentGate: { assert } as unknown as IBaishouAgentGate },
      execute
    )
    const result = await wrapped({})
    expect(result).toContain('未请求授权')
    expect(assert).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('passes preview into assert and verifies after approval', async () => {
    const assert = vi.fn().mockResolvedValue(undefined)
    const verifyBeforeExecute = vi.fn().mockResolvedValue(undefined)
    const execute = vi.fn().mockResolvedValue('ok')
    const metadata: AgentGateToolMetadata = {
      action: 'workspace_write',
      riskLevel: AgentGateRiskLevel.Mutating,
      prepare: async () => ({
        preview: {
          type: 'file_change',
          path: 'a.ts',
          kind: 'create',
          additions: 1,
          deletions: 0
        },
        description: '将创建 a.ts',
        verifyBeforeExecute
      })
    }
    const wrapped = wrapVercelToolExecuteWithAgentGate(
      'workspace_write',
      metadata,
      { ...baseContext, agentGate: { assert } as unknown as IBaishouAgentGate },
      execute
    )
    await expect(wrapped({})).resolves.toBe('ok')
    expect(assert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: AgentGateKind.Tool,
        preview: expect.objectContaining({ type: 'file_change', path: 'a.ts' }),
        description: '将创建 a.ts'
      })
    )
    expect(verifyBeforeExecute).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledOnce()
  })
})
