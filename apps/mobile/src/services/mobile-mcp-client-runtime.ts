import type { McpClientConfig, McpClientServerEntry, McpClientServerStatus } from '@baishou/shared'
import {
  buildExternalMcpVercelTools,
  type ExternalMcpToolDescriptor,
  type ToolContext
} from '@baishou/ai'
import {
  MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE,
  MCP_CLIENT_NOT_CONNECTED_MESSAGE,
  logger,
  mcpClientProbeReasonFromError,
  normalizeMcpStreamableUrl,
  toMcpClientListedTools,
  type McpClientListedTool,
  type McpClientProbeReason
} from '@baishou/shared'
import {
  getMobileMcpClientConfig,
  setMobileMcpClientConfig
} from './mobile-mcp-client-config.store'
import {
  callMcpHttpTool,
  closeMcpHttpClient,
  connectMcpHttpClient,
  listMcpHttpTools,
  MCP_HTTP_PROBE_TIMEOUT_MS,
  withMcpHttpTimeout,
  type McpHttpListedTool
} from './mobile-mcp-http-client'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

type SessionRecord = {
  entry: McpClientServerEntry
  client: Client
  transport: StreamableHTTPClientTransport
  tools: McpHttpListedTool[]
}

class MobileMcpClientRuntime {
  private sessions = new Map<string, SessionRecord>()
  private config: McpClientConfig = { servers: [] }
  private loaded = false
  private syncPromise: Promise<void> | null = null

  async ensureLoaded(): Promise<McpClientConfig> {
    if (!this.loaded) {
      this.config = await getMobileMcpClientConfig()
      this.loaded = true
    }
    return this.config
  }

  getConfig(): McpClientConfig {
    return this.config
  }

  async saveConfig(config: McpClientConfig): Promise<McpClientConfig> {
    const next = await setMobileMcpClientConfig(config)
    this.config = next
    this.loaded = true
    await this.syncSessions()
    return next
  }

  async listServerStatuses(): Promise<McpClientServerStatus[]> {
    await this.ensureLoaded()
    return Promise.all(
      this.config.servers.map(async (entry): Promise<McpClientServerStatus> => {
        if (!entry.enabled) {
          return { id: entry.id, connected: false, tools: [] }
        }
        const session = this.sessions.get(entry.id)
        const sessionFresh =
          session &&
          session.entry.url === entry.url &&
          (session.entry.authToken ?? '') === (entry.authToken ?? '')
        if (session && sessionFresh) {
          return {
            id: entry.id,
            connected: true,
            tools: session.tools.map((tool) => ({
              name: tool.name,
              description: tool.description
            }))
          }
        }
        const probed = await this.probeTools(entry.url, entry.authToken)
        return {
          id: entry.id,
          connected: probed.ok,
          tools: probed.tools,
          error: probed.error,
          reason: probed.reason
        }
      })
    )
  }

  async testConnection(
    url: string,
    authToken?: string
  ): Promise<{
    ok: boolean
    tools?: McpClientListedTool[]
    error?: string
    reason?: McpClientProbeReason
  }> {
    const result = await this.probeTools(url, authToken)
    if (result.ok && result.rawTools) {
      const normalized = normalizeMcpStreamableUrl(url)
      if (normalized.ok) {
        for (const session of this.sessions.values()) {
          if (
            session.entry.url === normalized.url &&
            (session.entry.authToken ?? '') === (authToken?.trim() ?? '')
          ) {
            session.tools = result.rawTools
          }
        }
      }
    }
    return result
  }

  private async probeTools(
    url: string,
    authToken?: string
  ): Promise<{
    ok: boolean
    tools: McpClientListedTool[]
    rawTools?: McpHttpListedTool[]
    error?: string
    reason?: McpClientProbeReason
  }> {
    const normalized = normalizeMcpStreamableUrl(url)
    if (!normalized.ok) {
      return { ok: false, reason: normalized.reason, tools: [] }
    }
    let session: Awaited<ReturnType<typeof connectMcpHttpClient>> | null = null
    try {
      const tools = await withMcpHttpTimeout(
        (async () => {
          const connected = await connectMcpHttpClient({
            url: normalized.url,
            authToken
          })
          session = connected
          return listMcpHttpTools(connected.client)
        })(),
        MCP_HTTP_PROBE_TIMEOUT_MS,
        MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE
      )
      return { ok: true, tools: toMcpClientListedTools(tools), rawTools: tools }
    } catch (error) {
      return {
        ok: false,
        reason: mcpClientProbeReasonFromError(error),
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
          inputSchema: tool.inputSchema,
          alwaysAllow: session.entry.alwaysAllow
        })
      }
    }
    return buildExternalMcpVercelTools({
      tools: descriptors,
      context,
      callTool: async (serverId, toolName, args) => {
        let session = this.sessions.get(serverId)
        if (!session) {
          const entry = this.config.servers.find((s) => s.id === serverId && s.enabled)
          if (entry) {
            try {
              const connected = await connectMcpHttpClient({
                url: entry.url,
                authToken: entry.authToken
              })
              const tools = await listMcpHttpTools(connected.client)
              session = {
                entry,
                client: connected.client,
                transport: connected.transport,
                tools
              }
              this.sessions.set(serverId, session)
            } catch (err) {
              logger.warn(
                `[mobile-mcp-client-runtime] reconnect on call failed: ${entry.name}`,
                err as Error
              )
            }
          }
        }
        if (!session) {
          throw new Error(MCP_CLIENT_NOT_CONNECTED_MESSAGE)
        }
        try {
          return await callMcpHttpTool(session.client, toolName, args)
        } catch (error) {
          logger.warn(
            `[mobile-mcp-client-runtime] callTool failed, attempting reconnect: ${toolName}`,
            error as Error
          )
          try {
            await closeMcpHttpClient(session)
          } catch {}
          this.sessions.delete(serverId)
          const entry = this.config.servers.find((s) => s.id === serverId && s.enabled)
          if (!entry) throw error
          const reconnected = await connectMcpHttpClient({
            url: entry.url,
            authToken: entry.authToken
          })
          const tools = await listMcpHttpTools(reconnected.client)
          const nextSession = {
            entry,
            client: reconnected.client,
            transport: reconnected.transport,
            tools
          }
          this.sessions.set(serverId, nextSession)
          return await callMcpHttpTool(nextSession.client, toolName, args)
        }
      }
    })
  }

  private async syncSessions(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise
    }
    this.syncPromise = this.runSyncSessions().finally(() => {
      this.syncPromise = null
    })
    return this.syncPromise
  }

  private async runSyncSessions(): Promise<void> {
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
      const existing = this.sessions.get(entry.id)
      if (existing) {
        if (existing.tools.length > 0) continue
        try {
          existing.tools = await listMcpHttpTools(existing.client)
          continue
        } catch {
          await closeMcpHttpClient(existing)
          this.sessions.delete(entry.id)
        }
      }
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
          `[mobile-mcp-client-runtime] connect failed: ${entry.name} ${entry.url}`,
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

let runtime: MobileMcpClientRuntime | null = null

export function getMobileMcpClientRuntime(): MobileMcpClientRuntime {
  if (!runtime) runtime = new MobileMcpClientRuntime()
  return runtime
}

export function resetMobileMcpClientRuntimeForTest(): void {
  runtime = null
}

export async function mobileExtraVercelToolsFactory(
  context: ToolContext
): Promise<Record<string, unknown>> {
  const instance = getMobileMcpClientRuntime()
  await instance.ensureLoaded()
  if (!instance.getConfig().servers.some((server) => server.enabled)) {
    return {}
  }
  return instance.toVercelTools(context)
}
