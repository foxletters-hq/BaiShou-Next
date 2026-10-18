import { jsonSchema, tool } from 'ai'
import {
  AgentGateRiskLevel,
  buildExternalMcpToolId,
  formatMcpClientToolResult,
  isMcpExposableToolId,
  summarizeMcpToolDescription,
  type AgentGateToolMetadata
} from '@baishou/shared'
import type { ToolContext } from '../tools/agent.tool'
import { resolveAgentGateToolMetadata } from '../baishou-agent-gate/agent-gate-tool-metadata'
import { wrapVercelToolExecuteWithAgentGate } from '../baishou-agent-gate/baishou-agent-gate-tool.interceptor'
import { unwrapBaishouMcpToolName } from '../tools/mcp-tool.util'
import { getBaishouMcpToolDescription } from './baishou-mcp-tools'

/** 外部 MCP 统一调用入口工具名（避免将每个远端工具单独注入 tools 数组导致上下文膨胀） */
export const EXTERNAL_MCP_GATEWAY_TOOL_ID = 'mcp_call'

const MAX_CATALOG_CHARS = 4000

export type ExternalMcpToolDescriptor = {
  serverId: string
  serverName: string
  name: string
  description?: string
  inputSchema?: unknown
  alwaysAllow?: boolean
}

export type ExternalMcpToolCaller = (
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
) => Promise<unknown>

function asObjectJsonSchema(raw: unknown): {
  $schema?: string
  type: 'object'
  properties: Record<string, unknown>
  required: string[]
  additionalProperties?: boolean
} {
  if (!raw || typeof raw !== 'object') {
    return { type: 'object', properties: {}, required: [] }
  }
  const schema = raw as Record<string, unknown>
  const properties =
    schema.properties && typeof schema.properties === 'object'
      ? (schema.properties as Record<string, unknown>)
      : {}
  return {
    type: 'object',
    properties,
    required: Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === 'string')
      : []
  }
}

const READ_ONLY_TOOL_PREFIXES = [
  'get_',
  'read_',
  'search_',
  'list_',
  'fetch_',
  'find_',
  'query_',
  'check_',
  'inspect_',
  'view_',
  'lookup_',
  'show_',
  'retrieve_'
]

const READ_ONLY_TOOL_EXACT = new Set([
  'fetch',
  'search',
  'query',
  'lookup',
  'list',
  'read',
  'inspect',
  'ping',
  'weather'
])

export function isReadOnlyExternalMcpTool(name: string, description?: string): boolean {
  const builtinName = unwrapBaishouMcpToolName(name)
  if (builtinName && isMcpExposableToolId(builtinName)) {
    const builtin = resolveAgentGateToolMetadata(builtinName)
    if (builtin) return builtin.riskLevel === AgentGateRiskLevel.Safe
  }
  const lower = name.toLowerCase()
  if (READ_ONLY_TOOL_EXACT.has(lower)) return true
  if (READ_ONLY_TOOL_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true
  const lowerDesc = (description || '').toLowerCase()
  if (
    (lowerDesc.includes('search') ||
      lowerDesc.includes('query') ||
      lowerDesc.includes('fetch') ||
      lowerDesc.includes('read') ||
      lowerDesc.includes('list') ||
      lowerDesc.includes('查询') ||
      lowerDesc.includes('搜索') ||
      lowerDesc.includes('获取')) &&
    !lowerDesc.includes('create') &&
    !lowerDesc.includes('update') &&
    !lowerDesc.includes('delete') &&
    !lowerDesc.includes('modify') &&
    !lowerDesc.includes('创建') &&
    !lowerDesc.includes('修改') &&
    !lowerDesc.includes('删除')
  ) {
    return true
  }
  return false
}

export function remoteMcpGateMetadata(
  serverName: string,
  toolName: string,
  description?: string,
  alwaysAllow?: boolean
): AgentGateToolMetadata {
  const isReadOnly = isReadOnlyExternalMcpTool(toolName, description)
  const isSafe = isReadOnly || alwaysAllow === true
  return {
    action: `mcp_client:${toolName}`,
    riskLevel: isSafe ? AgentGateRiskLevel.Safe : AgentGateRiskLevel.Mutating,
    buildTitle: () => `MCP · ${serverName} · ${toolName}`
  }
}

function formatCompactPropertyType(rawProp: unknown): string {
  if (!rawProp || typeof rawProp !== 'object') return 'unknown'
  const prop = rawProp as Record<string, unknown>
  if (Array.isArray(prop.enum) && prop.enum.length > 0 && prop.enum.length <= 5) {
    return prop.enum.map((v) => JSON.stringify(v)).join(' | ')
  }
  if (prop.type === 'array') {
    const items = prop.items as Record<string, unknown> | undefined
    const itemType = items && typeof items.type === 'string' ? items.type : 'unknown'
    return `${itemType}[]`
  }
  if (typeof prop.type === 'string') return prop.type
  return 'unknown'
}

export function formatCompactMcpInputSignature(inputSchema: unknown): string {
  const obj = asObjectJsonSchema(inputSchema)
  const keys = Object.keys(obj.properties)
  if (keys.length === 0) return ''
  const requiredSet = new Set(obj.required)
  const parts = keys.map((key) => {
    const opt = requiredSet.has(key) ? '' : '?'
    return `${key}${opt}: ${formatCompactPropertyType(obj.properties[key])}`
  })
  return `{ ${parts.join(', ')} }`
}

function summarizeExternalToolEntry(item: ExternalMcpToolDescriptor): string {
  const builtinName = unwrapBaishouMcpToolName(item.name)
  const summary =
    builtinName && isMcpExposableToolId(builtinName)
      ? getBaishouMcpToolDescription(item.name, item.description)
      : summarizeMcpToolDescription(item.description, 100) || 'External MCP tool'
  const sig = formatCompactMcpInputSignature(item.inputSchema)
  return `  - ${item.name}(${sig}): ${summary}`
}

export function buildExternalMcpCatalogDescription(tools: ExternalMcpToolDescriptor[]): string {
  const byServer = new Map<string, ExternalMcpToolDescriptor[]>()
  for (const item of tools) {
    const serverLabel = item.serverName?.trim() || item.serverId
    const group = byServer.get(serverLabel) ?? []
    group.push(item)
    byServer.set(serverLabel, group)
  }

  const lines: string[] = [
    'Invoke a tool on a connected external MCP server.',
    'Pass `tool` (exact tool name from the catalog below) and `arguments` (object matching its parameter signature).',
    '',
    'Available MCP tools:'
  ]

  let usedChars = lines.join('\n').length
  for (const [serverLabel, group] of byServer.entries()) {
    const header = `[Server: ${serverLabel}]`
    lines.push(header)
    usedChars += header.length + 1
    let shown = 0
    for (const item of group) {
      const entry = summarizeExternalToolEntry(item)
      if (usedChars + entry.length + 1 > MAX_CATALOG_CHARS && shown > 0) {
        const remaining = group.length - shown
        lines.push(`  - ... (+${remaining} more tools on ${serverLabel})`)
        break
      }
      lines.push(entry)
      usedChars += entry.length + 1
      shown++
    }
  }

  return lines.join('\n')
}

function extractMcpCallTargetAndArgs(rawArgs: Record<string, unknown> | undefined): {
  serverHint: string
  toolName: string
  callArgs: Record<string, unknown>
} {
  if (!rawArgs || typeof rawArgs !== 'object') {
    return { serverHint: '', toolName: '', callArgs: {} }
  }
  const serverHint = typeof rawArgs.server === 'string' ? rawArgs.server.trim() : ''
  const toolName =
    typeof rawArgs.tool === 'string'
      ? rawArgs.tool.trim()
      : typeof rawArgs.name === 'string'
        ? rawArgs.name.trim()
        : ''

  if (
    rawArgs.arguments &&
    typeof rawArgs.arguments === 'object' &&
    !Array.isArray(rawArgs.arguments)
  ) {
    return {
      serverHint,
      toolName,
      callArgs: rawArgs.arguments as Record<string, unknown>
    }
  }
  if (typeof rawArgs.arguments === 'string' && rawArgs.arguments.trim()) {
    try {
      const parsed = JSON.parse(rawArgs.arguments)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { serverHint, toolName, callArgs: parsed as Record<string, unknown> }
      }
    } catch {
      // fall through
    }
  }
  if (rawArgs.args && typeof rawArgs.args === 'object' && !Array.isArray(rawArgs.args)) {
    return {
      serverHint,
      toolName,
      callArgs: rawArgs.args as Record<string, unknown>
    }
  }

  const fallbackArgs: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rawArgs)) {
    if (key === 'server' || key === 'tool' || key === 'name' || key === 'arguments' || key === 'args') {
      continue
    }
    fallbackArgs[key] = value
  }
  return { serverHint, toolName, callArgs: fallbackArgs }
}

function findTargetExternalTool(
  tools: ExternalMcpToolDescriptor[],
  serverHint: string,
  toolName: string
): ExternalMcpToolDescriptor | undefined {
  if (!toolName) {
    return tools.length === 1 ? tools[0] : undefined
  }
  const lowerServer = serverHint.toLowerCase()
  const serverFiltered = lowerServer
    ? tools.filter(
        (t) =>
          t.serverName.toLowerCase() === lowerServer || t.serverId.toLowerCase() === lowerServer
      )
    : tools
  const pool = serverFiltered.length > 0 ? serverFiltered : tools

  const exact = pool.find((t) => t.name === toolName)
  if (exact) return exact

  const byLegacyId = pool.find((t) => buildExternalMcpToolId(t.serverId, t.name) === toolName)
  if (byLegacyId) return byLegacyId

  const unwrapped = unwrapBaishouMcpToolName(toolName)
  return pool.find((t) => unwrapBaishouMcpToolName(t.name) === unwrapped)
}

export function buildExternalMcpVercelTools(params: {
  tools: ExternalMcpToolDescriptor[]
  callTool: ExternalMcpToolCaller
  context: ToolContext
}): Record<string, unknown> {
  if (!Array.isArray(params.tools) || params.tools.length === 0) {
    return {}
  }

  const description = buildExternalMcpCatalogDescription(params.tools)

  const gatewayTool = tool({
    description,
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description:
            'Optional MCP server name or ID when multiple servers expose the same tool name.'
        },
        tool: {
          type: 'string',
          description:
            'Exact MCP tool name from the Available MCP tools catalog.'
        },
        arguments: {
          type: 'object',
          description: 'Arguments object matching the target MCP tool parameter signature.',
          additionalProperties: true
        }
      },
      required: ['tool']
    } as any),
    execute: (async (rawArgs: Record<string, unknown>) => {
      const { serverHint, toolName, callArgs } = extractMcpCallTargetAndArgs(rawArgs)
      const target = findTargetExternalTool(params.tools, serverHint, toolName)
      if (!target) {
        const available = params.tools.map((t) => t.name).join(', ')
        return `Error: Unknown MCP tool "${toolName || '(empty)'}". Available MCP tools: ${available}`
      }

      const gateToolId = buildExternalMcpToolId(target.serverId, target.name)
      const runExecute = async (args: Record<string, unknown>) => {
        const result = await params.callTool(target.serverId, target.name, args ?? {})
        return formatMcpClientToolResult(result)
      }
      const gatedExecute = wrapVercelToolExecuteWithAgentGate(
        gateToolId,
        remoteMcpGateMetadata(
          target.serverName,
          target.name,
          target.description,
          target.alwaysAllow
        ),
        params.context,
        runExecute
      )
      return gatedExecute(callArgs)
    }) as any
  })

  return {
    [EXTERNAL_MCP_GATEWAY_TOOL_ID]: gatewayTool
  }
}
