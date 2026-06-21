import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { ToolRegistry } from '../../tools/tool-registry'
import {
  negotiateMcpProtocolVersion,
  buildBaishouMcpToolSchemas,
  executeBaishouMcpTool,
  listBaishouMcpToolsForUi
} from '../baishou-mcp-server'
import { DEFAULT_NEGOTIATED_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import type { ToolContext } from '../../tools/agent.tool'

const baseContext: ToolContext = {
  sessionId: 'mcp-external',
  vaultName: 'Personal',
  userConfig: {
    ragEnabled: true,
    hasEmbeddingModel: false,
    disabledToolIds: [],
    web_search_enabled: false
  }
}

describe('baishou-mcp-server', () => {
  it('negotiates supported client protocol versions', () => {
    expect(negotiateMcpProtocolVersion('2025-11-25')).toBe('2025-11-25')
    expect(negotiateMcpProtocolVersion('2024-11-05')).toBe('2024-11-05')
  })

  it('falls back to default protocol version for unknown clients', () => {
    expect(negotiateMcpProtocolVersion('2099-01-01')).toBe(DEFAULT_NEGOTIATED_PROTOCOL_VERSION)
    expect(negotiateMcpProtocolVersion(undefined)).toBe(DEFAULT_NEGOTIATED_PROTOCOL_VERSION)
  })

  it('returns empty tool schemas when registry is missing', () => {
    const context: ToolContext = {
      sessionId: 'mcp-external',
      vaultName: 'Personal',
      userConfig: {}
    }
    expect(buildBaishouMcpToolSchemas(undefined, context)).toEqual([])
  })

  it('exposes diary tools from the default registry for MCP UI and protocol', () => {
    const registry = new ToolRegistry()
    const uiTools = listBaishouMcpToolsForUi(registry, baseContext)
    const mcpTools = buildBaishouMcpToolSchemas(registry, baseContext)

    expect(uiTools.length).toBeGreaterThan(0)
    expect(mcpTools.length).toBeGreaterThan(0)
    expect(uiTools.some((tool) => tool.name === 'baishou_diary_list')).toBe(true)
    expect(mcpTools.some((tool) => tool.name === 'baishou_diary_list')).toBe(true)
  })

  it('builds MCP tool schemas from registry', () => {
    const registry = {
      getEnabledToolsRaw: () => [
        {
          name: 'current_time',
          description: 'Current time',
          parameters: z.object({}),
          execute: async () => 'ok'
        }
      ]
    } as unknown as ToolRegistry

    const tools = buildBaishouMcpToolSchemas(registry, {
      sessionId: 'mcp-external',
      vaultName: 'Personal',
      userConfig: {}
    })

    expect(tools).toHaveLength(1)
    const tool = tools[0]!
    expect(tool.name).toBe('baishou_current_time')
    expect(tool.inputSchema.type).toBe('object')
  })

  it('executeBaishouMcpTool rejects missing registry', async () => {
    await expect(
      executeBaishouMcpTool(
        undefined,
        async () => ({
          sessionId: 'mcp-external',
          vaultName: 'Personal',
          userConfig: {}
        }),
        { name: 'baishou_test' }
      )
    ).rejects.toThrow('Tool registry not initialized')
  })

  it('executeBaishouMcpTool runs enabled tools', async () => {
    const registry = {
      get: (name: string) =>
        name === 'current_time'
          ? {
              name: 'current_time',
              execute: vi.fn().mockResolvedValue('done')
            }
          : undefined,
      isToolEnabled: () => true
    } as unknown as ToolRegistry

    const result = await executeBaishouMcpTool(
      registry,
      async () => ({
        sessionId: 'mcp-external',
        vaultName: 'Personal',
        userConfig: {}
      }),
      { name: 'baishou_current_time' }
    )

    expect(result.isError).toBe(false)
    expect(result.content[0]?.text).toBe('done')
  })
})
