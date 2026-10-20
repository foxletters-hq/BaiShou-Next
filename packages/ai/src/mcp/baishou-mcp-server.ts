import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  InitializeRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { DEFAULT_AGENT_SKILLS, mergeSkillCatalogEntries } from '@baishou/shared'
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
  isToolDisabledByMcp,
  listBaishouMcpExposedTools,
  listBaishouMcpToolsForUi,
  negotiateMcpProtocolVersion,
  toBaishouMcpInputSchema,
  type BaishouMcpToolListItem,
  type BaishouMcpToolSchema
} from './baishou-mcp-tools'

/** 内置技能兜底条目（磁盘技能缺失时仍可被外部客户端列出/读取） */
function builtinSkillEntries(): Array<{ name: string; description?: string }> {
  return DEFAULT_AGENT_SKILLS.map((skill) => ({
    name: skill.name,
    description: skill.description
  }))
}

export async function listMcpPromptDescriptors(context: ToolContext) {
  let fromDisk: Array<{ name: string; description?: string }> = []
  try {
    fromDisk =
      (await context.skillsReader?.listAllSkills?.()) ??
      (await context.skillsReader?.listSkills?.()) ??
      []
  } catch {
    fromDisk = []
  }
  const entries = mergeSkillCatalogEntries(builtinSkillEntries(), fromDisk)
  return entries
    .filter((entry) => entry.name.trim().length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      name: entry.name,
      ...(entry.description ? { description: entry.description } : {})
    }))
}

export async function readMcpPromptSkill(context: ToolContext, name: string) {
  let fromDisk: Awaited<ReturnType<NonNullable<ToolContext['skillsReader']>['readSkill']>> = null
  try {
    fromDisk = (await context.skillsReader?.readSkill(name)) ?? null
  } catch {
    fromDisk = null
  }
  if (fromDisk) return fromDisk
  const builtin = DEFAULT_AGENT_SKILLS.find((skill) => skill.name === name)
  if (!builtin) return null
  return {
    name: builtin.name,
    description: builtin.description,
    content: builtin.content,
    location: `AI/skills/${builtin.name}/SKILL.md`
  }
}

export function createBaishouMcpServer(
  appVersion: string,
  toolRegistry: ToolRegistry | undefined,
  resolveToolContext: () => Promise<ToolContext>
): Server {
  const server = new Server(
    { name: 'BaiShou MCP Server', version: appVersion },
    { capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } } }
  )

  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    const { vaultName } = await resolveToolContext()
    const protocolVersion = negotiateMcpProtocolVersion(request.params.protocolVersion)
    return {
      protocolVersion,
      capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
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

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const context = await resolveToolContext()
    return { prompts: await listMcpPromptDescriptors(context) }
  })

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const context = await resolveToolContext()
    const name = String(request.params.name ?? '').trim()
    const skill = name ? await readMcpPromptSkill(context, name) : null
    if (!skill) {
      throw new Error(`Prompt not found: ${name}`)
    }
    return {
      description: skill.description || skill.name,
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: skill.content }
        }
      ]
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
