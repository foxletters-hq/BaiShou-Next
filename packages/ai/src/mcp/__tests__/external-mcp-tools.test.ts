import { describe, expect, it, vi } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import {
  EXTERNAL_MCP_GATEWAY_TOOL_ID,
  buildExternalMcpVercelTools
} from '../external-mcp-tools'
import type { ToolContext } from '../../tools/agent.tool'

describe('buildExternalMcpVercelTools', () => {
  it('converges remote tools into a single mcp_call gateway tool and forwards calls', async () => {
    const callTool = vi.fn(async () => ({
      content: [{ type: 'text', text: 'pong' }]
    }))
    const tools = buildExternalMcpVercelTools({
      tools: [
        {
          serverId: 'alpha',
          serverName: 'Alpha',
          name: 'ping',
          description: 'Ping the remote server\nExtra verbose second paragraph that should be omitted',
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

    expect(Object.keys(tools)).toEqual([EXTERNAL_MCP_GATEWAY_TOOL_ID])
    const vercelTool = tools[EXTERNAL_MCP_GATEWAY_TOOL_ID] as {
      description: string
      execute: (args: Record<string, unknown>) => Promise<string>
    }
    expect(vercelTool.description).toContain('[Server: Alpha]')
    expect(vercelTool.description).toContain('ping({ q: string }): Ping the remote server')
    expect(vercelTool.description).not.toContain('Extra verbose second paragraph')

    await expect(vercelTool.execute({ tool: 'ping', arguments: { q: 'hi' } })).resolves.toBe(
      'pong'
    )
    expect(callTool).toHaveBeenCalledWith('alpha', 'ping', { q: 'hi' })
  })

  it('includes remote baishou_* tools and third-party tools in the unified mcp_call catalog', async () => {
    const callTool = vi.fn(async () => ({
      content: [{ type: 'text', text: '2026-03-01 diary' }]
    }))
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
          inputSchema: {
            type: 'object',
            properties: {
              start_date: { type: 'string' },
              end_date: { type: 'string' }
            },
            required: ['start_date', 'end_date']
          }
        },
        {
          serverId: 'browser',
          serverName: 'Browser',
          name: 'navigate',
          description: 'Open a page',
          inputSchema: {
            type: 'object',
            properties: { url: { type: 'string' } },
            required: ['url']
          }
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

    expect(Object.keys(tools)).toEqual(['mcp_call'])
    const vercelTool = tools['mcp_call'] as {
      description: string
      execute: (args: Record<string, unknown>) => Promise<string>
    }
    expect(vercelTool.description).toContain('baishou_web_search')
    expect(vercelTool.description).toContain('baishou_url_read')
    expect(vercelTool.description).toContain(
      'baishou_diary_list({ start_date: string, end_date: string })'
    )
    expect(vercelTool.description).toContain('navigate({ url: string }): Open a page')

    await expect(
      vercelTool.execute({
        tool: 'baishou_diary_list',
        arguments: { start_date: '2026-03-01', end_date: '2026-03-07' }
      })
    ).resolves.toBe('2026-03-01 diary')
    expect(callTool).toHaveBeenCalledWith('local', 'baishou_diary_list', {
      start_date: '2026-03-01',
      end_date: '2026-03-07'
    })
  })

  it('should classify baishou_* read tools as Safe and mutating tools according to alwaysAllow', async () => {
    const { isReadOnlyExternalMcpTool, remoteMcpGateMetadata } =
      await import('../external-mcp-tools')
    expect(isReadOnlyExternalMcpTool('baishou_diary_list', 'List all diary entries')).toBe(true)
    expect(isReadOnlyExternalMcpTool('baishou_current_time', 'Get the current time')).toBe(true)
    expect(isReadOnlyExternalMcpTool('baishou_diary_write', 'Create a new diary entry')).toBe(false)
    expect(isReadOnlyExternalMcpTool('baishou_memory_delete', 'Delete memory')).toBe(false)

    expect(
      remoteMcpGateMetadata('白守', 'baishou_diary_list', 'List all diary entries', false).riskLevel
    ).toBe('safe')
    expect(
      remoteMcpGateMetadata('白守', 'baishou_diary_write', 'Create a new diary entry', false)
        .riskLevel
    ).toBe('mutating')
    expect(
      remoteMcpGateMetadata('白守', 'baishou_diary_write', 'Create a new diary entry', true)
        .riskLevel
    ).toBe('safe')
  })

  it('classifies read-only queries as Safe risk level and mutating as Mutating', async () => {
    const { isReadOnlyExternalMcpTool } = await import('../external-mcp-tools')
    expect(isReadOnlyExternalMcpTool('get_weather', 'Query weather info')).toBe(true)
    expect(isReadOnlyExternalMcpTool('search_books', 'Search books')).toBe(true)
    expect(isReadOnlyExternalMcpTool('fetch', 'Fetch URL')).toBe(true)
    expect(isReadOnlyExternalMcpTool('create_task', 'Create a new task')).toBe(false)
    expect(isReadOnlyExternalMcpTool('delete_database', 'Delete DB')).toBe(false)
  })

  it('disambiguates same-named tools across multiple servers via the server parameter', async () => {
    const callTool = vi.fn(async (serverId: string) => ({
      content: [{ type: 'text', text: `from-${serverId}` }]
    }))
    const tools = buildExternalMcpVercelTools({
      tools: [
        { serverId: 'server-alpha', serverName: 'Alpha', name: 'search' },
        { serverId: 'server-beta', serverName: 'Beta', name: 'search' }
      ],
      callTool,
      context: {} as ToolContext
    })
    const vercelTool = tools['mcp_call'] as {
      execute: (args: Record<string, unknown>) => Promise<string>
    }
    await expect(
      vercelTool.execute({ server: 'Beta', tool: 'search', arguments: { q: 'hello' } })
    ).resolves.toBe('from-server-beta')
    expect(callTool).toHaveBeenCalledWith('server-beta', 'search', { q: 'hello' })
  })

  it('marks mutating tool as Safe when alwaysAllow is true', async () => {
    const { remoteMcpGateMetadata } = await import('../external-mcp-tools')
    const mutatingMeta = remoteMcpGateMetadata(
      'TestServer',
      'create_task',
      'Create a new task',
      false
    )
    expect(mutatingMeta.riskLevel).toBe('mutating')

    const allowedMeta = remoteMcpGateMetadata(
      'TestServer',
      'create_task',
      'Create a new task',
      true
    )
    expect(allowedMeta.riskLevel).toBe('safe')
  })
})
