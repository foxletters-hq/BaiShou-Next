import type {
  McpClientConfig,
  McpClientServerEntry,
  McpClientServerStatus
} from '@baishou/shared'
import {
  buildExternalMcpVercelTools,
  type ExternalMcpToolDescriptor,
  type ToolContext
} from '@baishou/ai'
import {
  logger,
  normalizeMcpStreamableUrl,
  toMcpClientListedTools,
  type McpClientListedTool
} from '@baishou/shared'
import {
  getDesktopMcpClientConfig,
  setDesktopMcpClientConfig
} from './desktop-mcp-client-config.store'
import {
  callMcpHttpTool,
  closeMcpHttpClient,
  connectMcpHttpClient,
  listMcpHttpTools,
  type McpHttpListedTool
} from './mcp-http-client'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

type SessionRecord = {
  entry: McpClientServerEntry
  client: Client
  transport: StreamableHTTPClientTransport
  tools: McpHttpListedTool[]
}

class DesktopMcpClientRuntime {
  private sessions = new Map<string, SessionRecord>()
  private config: McpClientConfig = { servers: [] }
  private loaded = false

  async ensureLoaded(): Promise<McpClientConfig> {
    if (!this.loaded) {
      this.config = await getDesktopMcpClientConfig()
      this.loaded = true
    }
    return this.config
  }

  getConfig(): McpClientConfig {
    return this.config
  }

  async saveConfig(config: McpClientConfig): Promise<McpClientConfig> {
    const next = await setDesktopMcpClientConfig(config)
    this.config = next
    this.loaded = true
    await this.syncSessions()
    return next
  }

  async listServerStatuses(): Promise<McpClientServerStatus[]> {
    await this.ensureLoaded()
    const statuses: McpClientServerStatus[] = []
    for (const entry of this.config.servers) {
      if (!entry.enabled) {
        statuses.push({ id: entry.id, connected: false, tools: [] })
        continue
      }
      const session = this.sessions.get(entry.id)
      const sessionFresh =
        session &&
        session.entry.url === entry.url &&
        (session.entry.authToken ?? '') === (entry.authToken ?? '')
      if (session && sessionFresh) {
        statuses.push({
          id: entry.id,
          connected: true,
          tools: session.tools.map((tool) => ({
            name: tool.name,
            description: tool.description
          }))
        })
        continue
      }
      const probed = await this.probeTools(entry.url, entry.authToken)
      statuses.push({
        id: entry.id,
        connected: probed.ok,
        tools: probed.tools
      })
    }
    return statuses
  }

  async testConnection(url: string, authToken?: string): Promise<{
    ok: boolean
    tools?: McpClientListedTool[]
    error?: string
    reason?: 'empty' | 'invalid' | 'sse' | 'connect'
  }> {
    return this.probeTools(url, authToken)
  }

  private async probeTools(
    url: string,
    authToken?: string
  ): Promise<{
    ok: boolean
    tools: McpClientListedTool[]
    error?: string
    reason?: 'empty' | 'invalid' | 'sse' | 'connect'
  }> {
    const normalized = normalizeMcpStreamableUrl(url)
    if (!normalized.ok) {
      return { ok: false, reason: normalized.reason, tools: [] }
    }
    let session: Awaited<ReturnType<typeof connectMcpHttpClient>> | null = null
    try {
      session = await connectMcpHttpClient({
        url: normalized.url,
        authToken
      })
      const tools = await listMcpHttpTools(session.client)
      return { ok: true, tools: toMcpClientListedTools(tools) }
    } catch (error) {
      return {
        ok: false,
        reason: 'connect',
        tools: [],
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      if (session) {
        await closeMcpHttpClient(session)
      }
    }
  }

  async toVercelTools(context: ToolContext): Promise<Record<string, unknown>> {
    await this.ensureLoaded()
    await this.syncSessions()
    const descriptors: ExternalMcpToolDescriptor[] = []
    for (const session of this.sessions.values()) {
      for (const tool of session.tools) {
        descriptors.push({
          serverId: session.entry.id,
          serverName: session.entry.name,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        })
      }
    }
    return buildExternalMcpVercelTools({
      tools: descriptors,
      context,
      callTool: async (serverId, toolName, args) => {
        const session = this.sessions.get(serverId)
        if (!session) {
          throw new Error('外部 MCP 未连接')
        }
        return callMcpHttpTool(session.client, toolName, args)
      }
    })
  }

  private async syncSessions(): Promise<void> {
    const enabled = this.config.servers.filter((server) => server.enabled)
    const enabledIds = new Set(enabled.map((server) => server.id))

    for (const [id, session] of this.sessions) {
      const next = enabled.find((server) => server.id === id)
      const stale =
        !next ||
        next.url !== session.entry.url ||
        (next.authToken ?? '') !== (session.entry.authToken ?? '')
      if (stale) {
        await closeMcpHttpClient(session)
        this.sessions.delete(id)
      } else if (next) {
        session.entry = next
      }
    }

    for (const entry of enabled) {
      if (this.sessions.has(entry.id)) continue
      try {
        const connected = await connectMcpHttpClient({
          url: entry.url,
          authToken: entry.authToken
        })
        const tools = await listMcpHttpTools(connected.client)
        this.sessions.set(entry.id, {
          entry,
          client: connected.client,
          transport: connected.transport,
          tools
        })
      } catch (error) {
        logger.warn(
          `[mcp-client-runtime] connect failed: ${entry.name} ${entry.url}`,
          error as Error
        )
      }
    }

    for (const id of [...this.sessions.keys()]) {
      if (!enabledIds.has(id)) {
        const session = this.sessions.get(id)
        if (session) await closeMcpHttpClient(session)
        this.sessions.delete(id)
      }
    }
  }
}

let runtime: DesktopMcpClientRuntime | null = null

export function getDesktopMcpClientRuntime(): DesktopMcpClientRuntime {
  if (!runtime) runtime = new DesktopMcpClientRuntime()
  return runtime
}

export async function desktopExtraVercelToolsFactory(
  context: ToolContext
): Promise<Record<string, unknown>> {
  const instance = getDesktopMcpClientRuntime()
  await instance.ensureLoaded()
  if (!instance.getConfig().servers.some((server) => server.enabled)) {
    return {}
  }
  return instance.toVercelTools(context)
}
