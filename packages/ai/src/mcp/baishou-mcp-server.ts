import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  InitializeRequestSchema,
  ListToolsRequestSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  ToolSchema
} from '@modelcontextprotocol/sdk/types.js'
import { logger } from '@baishou/shared'
import { z } from 'zod'
import type { ToolContext } from '../tools/agent.tool'
import type { ToolRegistry } from '../tools/tool-registry'
import { buildMcpInstructions, formatMcpToolCallResult } from '../tools/mcp-tool.util'

export type BaishouMcpToolListItem = {
  name: string
  displayName?: string
  description: string
  category?: string
}

export type BaishouMcpToolSchema = {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required: string[] }
}

export function negotiateMcpProtocolVersion(clientVersion: unknown): string {
  if (
    typeof clientVersion === 'string' &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(clientVersion)
  ) {
    return clientVersion
  }
  return DEFAULT_NEGOTIATED_PROTOCOL_VERSION
}

/** MCP SDK 要求 inputSchema.type === "object"，且包含 properties 与 required。 */
export function toBaishouMcpInputSchema(parameters: z.ZodType) {
  const raw = z.toJSONSchema(parameters) as Record<string, unknown>
  return {
    type: 'object' as const,
    properties: (raw.properties as Record<string, unknown>) ?? {},
    required: Array.isArray(raw.required) ? raw.required : []
  }
}

export function listBaishouMcpToolsForUi(
  toolRegistry: ToolRegistry,
  context: ToolContext
): BaishouMcpToolListItem[] {
  return toolRegistry.getEnabledToolsRaw(context).map((tool) => ({
    name: `baishou_${tool.name}`,
    displayName: tool.displayName,
    description: tool.description,
    category: tool.category
  }))
}

export function buildBaishouMcpToolSchemas(
  toolRegistry: ToolRegistry | undefined,
  context: ToolContext
): BaishouMcpToolSchema[] {
  if (!toolRegistry) return []

  const mcpTools: BaishouMcpToolSchema[] = []

  for (const tool of toolRegistry.getEnabledToolsRaw(context)) {
    const name = `baishou_${tool.name}`
    const inputSchema = toBaishouMcpInputSchema(tool.parameters)
    try {
      const parsed = ToolSchema.parse({
        name,
        description: tool.description || name,
        inputSchema
      })
      mcpTools.push({
        name: parsed.name,
        description: parsed.description ?? name,
        inputSchema
      })
    } catch (e) {
      logger.error(`[BaishouMcpServer] Skipping invalid MCP tool "${name}":`, e as Error)
    }
  }

  return mcpTools
}

export async function executeBaishouMcpTool(
  toolRegistry: ToolRegistry | undefined,
  resolveToolContext: () => Promise<ToolContext>,
  params: { name: string; arguments?: Record<string, unknown> }
) {
  if (!toolRegistry) {
    throw new Error('Tool registry not initialized')
  }

  const rawName = (params.name || '').replace(/^baishou_/, '')
  if (!rawName) {
    throw new Error('Missing tool name')
  }

  const tool = toolRegistry.get(rawName)
  if (!tool) throw new Error(`Tool not found: ${rawName}`)

  const context = await resolveToolContext()
  if (!toolRegistry.isToolEnabled(rawName, context)) {
    throw new Error(`Tool not available: ${rawName}`)
  }

  const result = await tool.execute(params.arguments || {}, context)
  return formatMcpToolCallResult(typeof result === 'string' ? result : JSON.stringify(result))
}

export function createBaishouMcpServer(
  appVersion: string,
  toolRegistry: ToolRegistry | undefined,
  resolveToolContext: () => Promise<ToolContext>
): Server {
  const server = new Server(
    { name: 'BaiShou MCP Server', version: appVersion },
    { capabilities: { tools: { listChanged: false } } }
  )

  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    const { vaultName } = await resolveToolContext()
    const protocolVersion = negotiateMcpProtocolVersion(request.params.protocolVersion)
    return {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'BaiShou MCP Server', version: appVersion },
      instructions: buildMcpInstructions(vaultName)
    }
  })

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const context = await resolveToolContext()
    return {
      tools: buildBaishouMcpToolSchemas(toolRegistry, context)
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name
    const args = request.params.arguments || {}

    try {
      return await executeBaishouMcpTool(toolRegistry, resolveToolContext, {
        name: toolName,
        arguments: args
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
        isError: true
      }
    }
  })

  return server
}
