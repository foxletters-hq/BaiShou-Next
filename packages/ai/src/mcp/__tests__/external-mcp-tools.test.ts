import { describe, expect, it, vi } from 'vitest'
import { AgentGateDeniedError, AgentGateEffect, deriveLegacyVaultId } from '@baishou/shared'
import { buildExternalMcpVercelTools } from '../external-mcp-tools'
import type { ToolContext } from '../../tools/agent.tool'

describe('buildExternalMcpVercelTools', () => {
  it('wraps remote tools with prefixed ids and forwards calls', async () => {
    const callTool = vi.fn(async () => ({
      content: [{ type: 'text', text: 'pong' }]
    }))
    const tools = buildExternalMcpVercelTools({
      tools: [
        {
          serverId: 'alpha',
          serverName: 'Alpha',
          name: 'ping',
          description: 'Ping the remote server',
          inputSchema: {
            type: 'object',
            properties: { q: { type: 'string' } },
            required: ['q']
          }
        }
      ],
      callTool,
      context: {} as ToolContext
    })

    const id = Object.keys(tools)[0]!
    expect(id).toBe('mcp_alpha_ping')
    const vercelTool = tools[id] as { execute: (args: Record<string, unknown>) => Promise<string> }
    await expect(vercelTool.execute({ q: 'hi' })).resolves.toBe('pong')
    expect(callTool).toHaveBeenCalledWith('alpha', 'ping', { q: 'hi' })
  })

  it('hides built-in baishou_memory_delete when companion denied it', () => {
    const callTool = vi.fn()
    const tools = buildExternalMcpVercelTools({
      tools: [
        {
          serverId: 'local',
          serverName: 'BaiShou',
          name: 'baishou_memory_delete',
          description: 'Delete memory',
          inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
          serverId: 'local',
          serverName: 'BaiShou',
          name: 'baishou_diary_list',
          description: 'List diaries',
          inputSchema: { type: 'object', properties: {}, required: [] }
        }
      ],
      callTool,
      context: {
        sessionId: 's',
        vaultId: deriveLegacyVaultId('Personal'),
        vaultName: 'Personal',
        userConfig: { disabledToolIds: ['memory_delete'] }
      }
    })

    expect(Object.keys(tools)).toEqual(['mcp_local_baishou_diary_list'])
    expect(callTool).not.toHaveBeenCalled()
  })

  it('hides built-in baishou_memory_delete when gate probeEffect is Deny', () => {
    const callTool = vi.fn()
    const tools = buildExternalMcpVercelTools({
      tools: [
        {
          serverId: 'local',
          serverName: 'BaiShou',
          name: 'baishou_memory_delete',
          description: 'Delete memory',
          inputSchema: { type: 'object', properties: {}, required: [] }
        }
      ],
      callTool,
      context: {
        sessionId: 's',
        vaultId: deriveLegacyVaultId('Personal'),
        vaultName: 'Personal',
        userConfig: {},
        agentGate: {
          probeEffect: () => AgentGateEffect.Deny
        } as ToolContext['agentGate']
      }
    })

    expect(Object.keys(tools)).toEqual([])
    expect(callTool).not.toHaveBeenCalled()
  })

  it('asserts extra baishou_memory_delete as memory_delete, not mcp_client', async () => {
    const callTool = vi.fn()
    const assert = vi.fn(async (input: { action: string }) => {
      if (input.action === 'memory_delete') {
        throw new AgentGateDeniedError('memory_delete')
      }
    })
    const tools = buildExternalMcpVercelTools({
      tools: [
        {
          serverId: 'local',
          serverName: 'BaiShou',
          name: 'baishou_memory_delete',
          description: 'Delete memory',
          inputSchema: { type: 'object', properties: {}, required: [] }
        }
      ],
      callTool,
      context: {
        sessionId: 's',
        vaultId: deriveLegacyVaultId('Personal'),
        vaultName: 'Personal',
        userConfig: { baishou_agent_gate_config: { hideDeniedTools: false } },
        agentGate: {
          assert,
          probeEffect: () => AgentGateEffect.Deny
        } as unknown as ToolContext['agentGate']
      }
    })

    const id = Object.keys(tools)[0]
    expect(id).toBe('mcp_local_baishou_memory_delete')
    const vercelTool = tools[id] as { execute: (args: Record<string, unknown>) => Promise<string> }
    const result = await vercelTool.execute({ memory_id: 'mem-1' })
    expect(assert).toHaveBeenCalledWith(expect.objectContaining({ action: 'memory_delete' }))
    expect(callTool).not.toHaveBeenCalled()
    expect(result).toContain('已被禁用')
  })
})
