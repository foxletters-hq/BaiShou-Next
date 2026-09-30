import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import type { ToolContext } from '../tools/agent.tool'
import type { ToolRegistry } from '../tools/tool-registry'
import { syncMcpToolUserConfig } from '../tools/tool-context.util'
import { buildMcpInstructions } from '../tools/mcp-tool.util'
import {
  buildBaishouMcpToolSchemas,
  executeBaishouMcpTool,
  negotiateMcpProtocolVersion
} from './baishou-mcp-tools'

export {
  buildBaishouMcpToolSchemas,
  executeBaishouMcpTool,
  listBaishouMcpExposedTools,
  listBaishouMcpToolsForUi,
  negotiateMcpProtocolVersion,
  toBaishouMcpInputSchema,
  type BaishouMcpToolListItem,
  type BaishouMcpToolSchema
} from './baishou-mcp-tools'

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
    const context = syncMcpToolUserConfig(await resolveToolContext())
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
