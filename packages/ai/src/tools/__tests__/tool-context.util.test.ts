import { describe, it, expect } from 'vitest'
import { ToolRegistry } from '../tool-registry'
import { hasEmbeddingCapability, syncMcpToolUserConfig } from '../tool-context.util'
import { MCP_EXTERNAL_SESSION_ID } from '../mcp-tool.util'
import type { ToolContext } from '../agent.tool'

describe('tool-context.util', () => {
  it('detects embedding capability from runtime services', () => {
    const context: ToolContext = {
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultName: 'Personal',
      userConfig: { ragEnabled: true, hasEmbeddingModel: false },
      embeddingService: { isConfigured: true, embedQuery: async () => [] },
      vectorStore: { searchSimilar: async () => [], deleteBySource: async () => {} }
    }

    expect(hasEmbeddingCapability(context)).toBe(true)
    expect(syncMcpToolUserConfig(context).userConfig?.hasEmbeddingModel).toBe(true)
  })

  it('enables vector_search when runtime embedding is wired', () => {
    const registry = new ToolRegistry()
    const context: ToolContext = {
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultName: 'Personal',
      userConfig: { ragEnabled: true, hasEmbeddingModel: false },
      embeddingService: { isConfigured: true, embedQuery: async () => [] },
      vectorStore: { searchSimilar: async () => [], deleteBySource: async () => {} }
    }

    const enabled = registry.getEnabledToolsRaw(context).map((tool) => tool.name)
    expect(enabled).toContain('vector_search')
    expect(enabled).toContain('memory_store')
  })
})
