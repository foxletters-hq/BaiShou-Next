import { describe, expect, it, vi } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
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

  it('should omit built-in BaiShou mirrors so the in-app agent does not get a second web_search', () => {
    const callTool = vi.fn()
    const tools = buildExternalMcpVercelTools({
      tools: [
        {
          serverId: 'local',
          serverName: 'BaiShou',
          name: 'baishou_web_search',
          description: 'Search the web',
          inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
          serverId: 'local',
          serverName: 'BaiShou',
          name: 'baishou_url_read',
          description: 'Read a URL',
          inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
          serverId: 'local',
          serverName: 'BaiShou',
          name: 'baishou_diary_list',
          description: 'List diaries',
          inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
          serverId: 'browser',
          serverName: 'Browser',
          name: 'navigate',
          description: 'Open a page',
          inputSchema: { type: 'object', properties: {}, required: [] }
        }
      ],
      callTool,
      context: {
        sessionId: 's',
        vaultId: deriveLegacyVaultId('Personal'),
        vaultName: 'Personal',
        userConfig: {}
      }
    })

    expect(Object.keys(tools)).toEqual(['mcp_browser_navigate'])
    expect(callTool).not.toHaveBeenCalled()
  })

  it('should omit built-in mirrors even when hideDeniedTools is false', () => {
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
        userConfig: { baishou_agent_gate_config: { hideDeniedTools: false } }
      }
    })

    expect(Object.keys(tools)).toEqual([])
    expect(callTool).not.toHaveBeenCalled()
  })
})
