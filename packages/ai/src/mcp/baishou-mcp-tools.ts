import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  ToolSchema
} from '@modelcontextprotocol/sdk/types.js'
import { logger, isMcpExposableToolId, summarizeMcpToolDescription } from '@baishou/shared'
import { z } from 'zod'
import type { ToolContext } from '../tools/agent.tool'
import type { ToolRegistry } from '../tools/tool-registry'
import { syncMcpToolUserConfig } from '../tools/tool-context.util'
import { wrapVercelToolExecuteWithAgentGate } from '../baishou-agent-gate/baishou-agent-gate-tool.interceptor'
import { formatMcpToolCallResult, unwrapBaishouMcpToolName } from '../tools/mcp-tool.util'

export type BaishouMcpToolListItem = {
  name: string
  toolId?: string
  displayName?: string
  description: string
  category?: string
  enabled?: boolean
}

export type BaishouMcpToolSchema = {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required: string[] }
}

/**
 * 面向 MCP tools/list 与设置页列表的精简一行描述（避免将数百字内部 Prompt 规则直接暴露到 MCP 协议与 UI）。
 */
export const BAISHOU_MCP_CONCISE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  diary_read: 'Read full diary entries by exact YYYY-MM-DD dates (up to 20 per call).',
  diary_write: 'Create a new diary entry for a given YYYY-MM-DD date.',
  diary_edit: 'Append to or overwrite an existing diary entry for a given date.',
  diary_delete: 'Permanently delete the diary entry for a specific YYYY-MM-DD date.',
  diary_list: 'List diary dates and short previews within a YYYY-MM-DD date range.',
  diary_search: 'Search local personal diary entries by keyword or phrase.',
  summary_read: 'Read AI-generated period summaries (weekly, monthly, quarterly, or yearly).',
  message_search: 'Search past conversation messages by keyword or date range.',
  session_list: 'List active chat sessions and previews within a YYYY-MM-DD date range.',
  vector_search: 'Semantic vector search across conversation history and stored memories.',
  memory_store: 'Store an important fact or preference into long-term vector memory.',
  memory_delete: 'Delete a stored long-term memory item by its exact ID.',
  recall_relations:
    'Query the personal memory graph (entities, neighbors, paths, or timeline; read-only).',
  graph_upsert: 'Create, update, or remove entities and relations in the personal memory graph.',
  web_search: 'Search the public web for up-to-date facts, news, and information.',
  url_read: 'Fetch and read the main text content of a specific web URL.',
  current_time: 'Get the current real-world date, time, weekday, and timezone.',
  knowledge_search: 'Search uploaded documents and notes in the knowledge base.',
  knowledge_graph_search: 'Query entities and relationships in the knowledge base graph.'
}

export function getBaishouMcpToolDescription(toolId: string, fallbackDescription?: string): string {
  const rawId = toolId.replace(/^baishou_/, '')
  const concise = BAISHOU_MCP_CONCISE_DESCRIPTIONS[rawId]
  if (concise) return concise
  return summarizeMcpToolDescription(fallbackDescription, 140) || `baishou_${rawId}`
}

function isMcpExposableTool(toolName: string): boolean {
  return isMcpExposableToolId(toolName)
}

export function isToolDisabledByMcp(toolName: string, context: ToolContext): boolean {
  const disabledList = Array.isArray(context.userConfig?.['mcpDisabledToolIds'])
    ? (context.userConfig!['mcpDisabledToolIds'] as string[])
    : []
  const rawName = toolName.replace(/^baishou_/, '')
  return disabledList.includes(rawName) || disabledList.includes(toolName)
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

/**
 * 供 UI 设置页展示的候选工具完整列表。
 * 即使工具被 MCP 禁用，依然包含在列表中（附带 enabled 状态），便于用户重新开启。
 */
export function listBaishouMcpToolsForUi(
  toolRegistry: ToolRegistry | undefined,
  context: ToolContext
): BaishouMcpToolListItem[] {
  if (!toolRegistry) return []

  const syncedContext = syncMcpToolUserConfig(context)
  const tools: BaishouMcpToolListItem[] = []

  for (const tool of toolRegistry.getEnabledToolsRaw(syncedContext)) {
    if (!isMcpExposableTool(tool.name)) continue

    const mcpName = `baishou_${tool.name}`
    const isDisabled = isToolDisabledByMcp(tool.name, syncedContext)
    tools.push({
      name: mcpName,
      toolId: tool.name,
      displayName: tool.displayName,
      description: getBaishouMcpToolDescription(tool.name, tool.description),
      category: tool.category,
      enabled: !isDisabled
    })
  }

  return tools
}

/** 与 MCP tools/list 协议一致：仅返回成功生成 schema 且未被禁用的工具 */
export function listBaishouMcpExposedTools(
  toolRegistry: ToolRegistry | undefined,
  context: ToolContext
): BaishouMcpToolListItem[] {
  if (!toolRegistry) return []

  const syncedContext = syncMcpToolUserConfig(context)
  const schemas = buildBaishouMcpToolSchemas(toolRegistry, syncedContext)
  const toolsByName = new Map(
    toolRegistry.getEnabledToolsRaw(syncedContext).map((tool) => [tool.name, tool])
  )

  return schemas.map((schema) => {
    const rawName = schema.name.replace(/^baishou_/, '')
    const tool = toolsByName.get(rawName)
    return {
      name: schema.name,
      toolId: rawName,
      displayName: tool?.displayName,
      description: schema.description,
      category: tool?.category,
      enabled: true
    }
  })
}

export function buildBaishouMcpToolSchemas(
  toolRegistry: ToolRegistry | undefined,
  context: ToolContext
): BaishouMcpToolSchema[] {
  if (!toolRegistry) return []

  const syncedContext = syncMcpToolUserConfig(context)
  const mcpTools: BaishouMcpToolSchema[] = []

  for (const tool of toolRegistry.getEnabledToolsRaw(syncedContext)) {
    if (!isMcpExposableTool(tool.name)) continue
    if (isToolDisabledByMcp(tool.name, syncedContext)) continue

    const name = `baishou_${tool.name}`
    const description = getBaishouMcpToolDescription(tool.name, tool.description)
    const inputSchema = toBaishouMcpInputSchema(tool.parameters)
    try {
      const parsed = ToolSchema.parse({
        name,
        description,
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

  const rawName = unwrapBaishouMcpToolName(params.name || '')
  if (!rawName) {
    throw new Error('Missing tool name')
  }

  if (!isMcpExposableTool(rawName)) {
    throw new Error(`Tool not available: ${rawName}`)
  }

  const tool = toolRegistry.get(rawName)
  if (!tool) throw new Error(`Tool not found: ${rawName}`)

  const context = syncMcpToolUserConfig(await resolveToolContext())
  if (isToolDisabledByMcp(rawName, context)) {
    throw new Error(`Tool disabled via MCP: ${rawName}`)
  }

  if (!toolRegistry.isToolEnabled(rawName, context)) {
    throw new Error(`Tool not available: ${rawName}`)
  }

  const runExecute = async (args: Record<string, unknown>) => {
    const result = await tool.execute(args, context)
    return typeof result === 'string' ? result : JSON.stringify(result)
  }
  const execute = wrapVercelToolExecuteWithAgentGate(
    rawName,
    tool.agentGateMetadata,
    context,
    runExecute
  )
  const result = await execute(params.arguments || {})
  return formatMcpToolCallResult(result)
}
