import { jsonSchema, tool } from 'ai'
import {
  AgentGateRiskLevel,
  buildExternalMcpToolId,
  formatMcpClientToolResult,
  isMcpExposableToolId,
  type AgentGateToolMetadata
} from '@baishou/shared'
import type { ToolContext } from '../tools/agent.tool'
import { resolveAgentGateToolMetadata } from '../baishou-agent-gate/agent-gate-tool-metadata'
import { wrapVercelToolExecuteWithAgentGate } from '../baishou-agent-gate/baishou-agent-gate-tool.interceptor'
import { isNamedToolDenied } from '../tools/tool-context.util'
import { unwrapBaishouMcpToolName } from '../tools/mcp-tool.util'

export type ExternalMcpToolDescriptor = {
  serverId: string
  serverName: string
  name: string
  description?: string
  inputSchema?: unknown
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

function remoteMcpGateMetadata(serverName: string, toolName: string): AgentGateToolMetadata {
  const builtinName = unwrapBaishouMcpToolName(toolName)
  if (builtinName && isMcpExposableToolId(builtinName)) {
    const builtin = resolveAgentGateToolMetadata(builtinName)
    if (builtin) return builtin
  }
  return {
    action: `mcp_client:${toolName}`,
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: () => `MCP · ${serverName} · ${toolName}`
  }
}

export function buildExternalMcpVercelTools(params: {
  tools: ExternalMcpToolDescriptor[]
  callTool: ExternalMcpToolCaller
  context: ToolContext
}): Record<string, unknown> {
  const configured: Record<string, unknown> = {}
  const usedIds = new Set<string>()

  for (const item of params.tools) {
    const builtinName = unwrapBaishouMcpToolName(item.name)
    if (isMcpExposableToolId(builtinName) && isNamedToolDenied(builtinName, params.context)) {
      continue
    }

    let id = buildExternalMcpToolId(item.serverId, item.name)
    if (usedIds.has(id) || configured[id]) {
      id = `${id}_${usedIds.size}`
    }
    usedIds.add(id)

    const description = [
      item.description?.trim() || `外部 MCP 工具 ${item.name}`,
      `来源：${item.serverName}`
    ].join('\n')

    const runExecute = async (args: Record<string, unknown>) => {
      const result = await params.callTool(item.serverId, item.name, args ?? {})
      return formatMcpClientToolResult(result)
    }

    configured[id] = tool({
      description,
      inputSchema: jsonSchema(asObjectJsonSchema(item.inputSchema) as any),
      execute: wrapVercelToolExecuteWithAgentGate(
        id,
        remoteMcpGateMetadata(item.serverName, item.name),
        params.context,
        runExecute
      ) as any
    })
  }

  return configured
}
