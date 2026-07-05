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

  it('exposes vector_search when embedding model is configured', () => {
    const registry = new ToolRegistry()
    const context: ToolContext = {
      sessionId: 'mcp-external',
      vaultName: 'Personal',
      userConfig: {
        ragEnabled: true,
        hasEmbeddingModel: true,
        disabledToolIds: [],
        web_search_enabled: false
      }
    }

    const enabled = registry.getEnabledToolsRaw(context).map((tool) => tool.name)
    const mcpTools = buildBaishouMcpToolSchemas(registry, context).map((tool) => tool.name)

    expect(enabled).toContain('vector_search')
    expect(mcpTools).toContain('baishou_vector_search')
  })

  it('exposes vector_search when runtime embedding services are wired', () => {
    const registry = new ToolRegistry()
    const context: ToolContext = {
      sessionId: 'mcp-external',
      vaultName: 'Personal',
      userConfig: {
        ragEnabled: true,
        hasEmbeddingModel: false,
        disabledToolIds: [],
        web_search_enabled: false
      },
      embeddingService: { isConfigured: true, embedQuery: async () => [] },
      vectorStore: { searchSimilar: async () => [], deleteBySource: async () => {} }
    }

    const mcpTools = buildBaishouMcpToolSchemas(registry, context).map((tool) => tool.name)
    expect(mcpTools).toContain('baishou_vector_search')
  })

  it('hides vector_search when embedding model is unavailable', () => {
    const registry = new ToolRegistry()
    const context: ToolContext = {
      ...baseContext,
      userConfig: {
        ...baseContext.userConfig,
        hasEmbeddingModel: false
      }
    }

    const enabled = registry.getEnabledToolsRaw(context).map((tool) => tool.name)
    const mcpTools = buildBaishouMcpToolSchemas(registry, context).map((tool) => tool.name)

    expect(enabled).not.toContain('vector_search')
    expect(mcpTools).not.toContain('baishou_vector_search')
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

  it('only exposes built-in agent tools via MCP', () => {
    const registry = new ToolRegistry()
    const context: ToolContext = {
      sessionId: 'mcp-external',
      vaultName: 'Personal',
      userConfig: {
        ragEnabled: true,
        hasEmbeddingModel: true,
        disabledToolIds: [],
        web_search_enabled: true,
        emojiConfig: {
          enabled: true,
          emojis: [{ id: 'cat.png', name: 'cat', relativePath: 'emojis/cat.png' }]
        }
      }
    }

    const enabled = registry.getEnabledToolsRaw(context).map((tool) => tool.name)
    const mcpTools = buildBaishouMcpToolSchemas(registry, context).map((tool) => tool.name)

    expect(enabled).toContain('emoji_send')
    expect(enabled).toContain('web_search')
    expect(enabled).toContain('diary_write')
    expect(enabled).toContain('current_time')

    expect(mcpTools).not.toContain('baishou_emoji_send')
    expect(mcpTools).not.toContain('baishou_web_search')
    expect(mcpTools).not.toContain('baishou_url_read')
    expect(mcpTools).not.toContain('baishou_diary_write')
    expect(mcpTools).not.toContain('baishou_current_time')
    expect(mcpTools).toContain('baishou_diary_list')
    expect(mcpTools).toContain('baishou_vector_search')
  })

  it('does not expose emoji_send via MCP even when emoji config is enabled', () => {
    const registry = new ToolRegistry()
    const context: ToolContext = {
      ...baseContext,
      userConfig: {
        ...baseContext.userConfig,
        emojiConfig: {
          enabled: true,
          emojis: [{ id: 'cat.png', name: 'cat', relativePath: 'emojis/cat.png' }]
        }
      }
    }

    const enabled = registry.getEnabledToolsRaw(context).map((tool) => tool.name)
    const mcpTools = buildBaishouMcpToolSchemas(registry, context).map((tool) => tool.name)
    const uiTools = listBaishouMcpToolsForUi(registry, context).map((tool) => tool.name)

    expect(enabled).toContain('emoji_send')
    expect(mcpTools).not.toContain('baishou_emoji_send')
    expect(uiTools).not.toContain('baishou_emoji_send')
  })

  it('rejects emoji_send when invoked through MCP', async () => {
    const registry = new ToolRegistry()
    const context: ToolContext = {
      ...baseContext,
      userConfig: {
        ...baseContext.userConfig,
        emojiConfig: {
          enabled: true,
          emojis: [{ id: 'cat.png', name: 'cat', relativePath: 'emojis/cat.png' }]
        }
      }
    }

    await expect(
      executeBaishouMcpTool(registry, async () => context, {
        name: 'baishou_emoji_send',
        arguments: { emoji_id: 'cat.png' }
      })
    ).rejects.toThrow('Tool not available: emoji_send')
  })

  it('builds MCP tool schemas from registry', () => {
    const registry = {
      getEnabledToolsRaw: () => [
        {
          name: 'diary_list',
          description: 'List diaries',
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
    expect(tool.name).toBe('baishou_diary_list')
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
        name === 'diary_list'
          ? {
              name: 'diary_list',
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
      { name: 'baishou_diary_list' }
    )

    expect(result.isError).toBe(false)
    expect(result.content[0]?.text).toBe('done')
  })
})
