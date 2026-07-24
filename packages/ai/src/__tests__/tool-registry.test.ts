import { describe, it, expect, vi } from 'vitest'
import { AgentGateEffect, AgentGateProfileId } from '@baishou/shared'
import { ToolRegistry } from '../tools/tool-registry'
import { AgentTool, ToolContext } from '../tools/agent.tool'
import type { IBaishouAgentGate } from '../baishou-agent-gate/baishou-agent-gate.service'
import { z } from 'zod'

class ToolA extends AgentTool<z.ZodObject<{ msg: z.ZodString }>> {
  readonly name = 'tool_a'
  readonly description = 'Tool A for testing purpose only'
  readonly parameters = z.object({ msg: z.string() })
  async execute(args: { msg: string }, _context: ToolContext) {
    return 'A' + args.msg
  }
}

describe('ToolRegistry', () => {
  it('should register and retrieve tools correctly', () => {
    const registry = new ToolRegistry()
    const toolA = new ToolA()
    registry.register(toolA)

    expect(registry.get('tool_a')).toBe(toolA)
    // 应该在 getAllRaw 中也能找到
    const allNames = registry.getAllRaw().map((t) => t.name)
    expect(allNames).toContain('tool_a')
  })

  it('should generate a Vercel Tools map based on a session context', () => {
    const registry = new ToolRegistry()
    const toolA = new ToolA()
    registry.register(toolA)

    const mockCtx: ToolContext = {
      sessionId: 'test-session',
      vaultName: 'default'
    }
    const toolMap = registry.getEnabledToolsAsVercel(mockCtx)

    expect(toolMap).toHaveProperty('tool_a')
  })

  it('should return undefined for non-existent tool', () => {
    const registry = new ToolRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('registers graph_upsert and recall_relations tools', () => {
    const registry = new ToolRegistry()
    expect(registry.get('graph_upsert')?.name).toBe('graph_upsert')
    expect(registry.get('recall_relations')?.name).toBe('recall_relations')
  })

  it('hides tools denied by gate profile when hideDeniedTools is on', () => {
    const registry = new ToolRegistry()
    const probeEffect = vi.fn((input: { action: string }) =>
      input.action.startsWith('workspace_') ? AgentGateEffect.Deny : AgentGateEffect.Ask
    )
    const gate = { probeEffect } as unknown as IBaishouAgentGate

    const ctx: ToolContext = {
      sessionId: 's1',
      vaultName: 'Personal',
      agentGate: gate,
      gateProfile: AgentGateProfileId.Companion,
      userConfig: {
        baishou_agent_gate_config: { hideDeniedTools: true }
      },
      workspace: {
        folderRoot: 'D:/proj',
        sessionKind: 'companion'
      }
    }

    // companion session with folderRoot still must not expose workspace tools if gate denies
    expect(registry.isToolEnabled('workspace_write', ctx)).toBe(false)
    expect(probeEffect).toHaveBeenCalled()
  })

  it('respects per-workspace disabledToolIds for workspace tools only', () => {
    const registry = new ToolRegistry()
    const ctx: ToolContext = {
      sessionId: 'ws-session',
      vaultName: 'Personal',
      userConfig: {
        disabledToolIds: ['workspace_run', 'diary_write']
      },
      workspace: {
        folderRoot: 'D:/proj',
        sessionKind: 'workspace'
      }
    }

    expect(registry.isToolEnabled('workspace_list', ctx)).toBe(true)
    expect(registry.isToolEnabled('workspace_run', ctx)).toBe(false)
    // diary tools are hard-filtered out of workspace sessions regardless of disabled list
    expect(registry.isToolEnabled('diary_write', ctx)).toBe(false)
    expect(registry.isToolEnabled('companion_ask', ctx)).toBe(true)
  })
})
