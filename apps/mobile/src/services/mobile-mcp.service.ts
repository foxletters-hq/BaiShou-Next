import {
  ToolRegistry,
  type ToolContext,
  buildMcpInstructions,
  formatMcpToolCallResult
} from '@baishou/ai'
import type { SettingsManagerService } from '@baishou/core-mobile'
import type { McpServerConfig } from '@baishou/shared'
import { isMcpRequestAuthorized, logger } from '@baishou/shared'
import * as Crypto from 'expo-crypto'
import { zodToJsonSchema } from 'zod-to-json-schema'
import * as BaishouServer from 'expo-baishou-server'
import type { McpHttpResponseEnvelope } from 'expo-baishou-server'
import { APP_VERSION } from '../app-version'
import { MOBILE_MCP_ENABLED } from '../config/mobile-features'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004
}

const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
  '2024-10-07'
] as const

type McpToolListItem = {
  name: string
  displayName?: string
  description: string
  category?: string
}

type McpSession = {
  protocolVersion: string
}

export class MobileMcpService {
  private mcpListenerSub: { remove: () => void } | null = null
  private isRunning = false
  private activePort = 0
  private readonly sessions = new Map<string, McpSession>()

  constructor(
    private readonly settingsManager: SettingsManagerService,
    private readonly toolRegistry: ToolRegistry,
    private readonly resolveToolContext: () => Promise<ToolContext>
  ) {}

  async getConfig(): Promise<McpServerConfig> {
    return (
      (await this.settingsManager.get<McpServerConfig>('mcp_server_config')) ?? DEFAULT_MCP_CONFIG
    )
  }

  async getToolsList(): Promise<McpToolListItem[]> {
    const context = await this.resolveToolContext()
    return this.toolRegistry.getEnabledToolsRaw(context).map((tool) => ({
      name: `baishou_${tool.name}`,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category
    }))
  }

  getActivePort(): number {
    return this.activePort
  }

  isServerRunning(): boolean {
    return this.isRunning
  }

  async start(): Promise<void> {
    if (!MOBILE_MCP_ENABLED) return
    const config = await this.getConfig()
    if (!config.mcpEnabled) return
    await this.startOnPort(config)
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return
    this.teardownListener()
    BaishouServer.stopServer()
    this.isRunning = false
    this.activePort = 0
    this.sessions.clear()
    logger.info('[MobileMcpService] Server stopped')
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  /** Apply config after settings UI changes (persists externally). */
  async applyConfig(config: McpServerConfig): Promise<void> {
    if (!MOBILE_MCP_ENABLED) return
    if (config.mcpEnabled) {
      await this.startOnPort(config)
    } else {
      await this.stop()
    }
  }

  private async startOnPort(config: McpServerConfig): Promise<void> {
    if (!BaishouServer.isBaishouServerAvailable()) {
      logger.warn(
        '[MobileMcpService] ExpoBaishouServer 未编入 APK，跳过 MCP。请 pnpm dev:mobile:clear 重装开发版。'
      )
      return
    }

    this.teardownListener()

    const port = config.mcpPort || DEFAULT_MCP_CONFIG.mcpPort
    const authToken = config.mcpAuthToken?.trim() || undefined
    const boundPort = BaishouServer.startMcpServer(port, authToken)
    if (boundPort <= 0) {
      throw new Error(`Failed to start MCP HTTP server on port ${port}`)
    }

    this.mcpListenerSub = BaishouServer.onMcpHttpRequest((event) => {
      void this.handleMcpHttpRequest(event.requestId, event.method, event.headers, event.body)
    })

    this.isRunning = true
    this.activePort = boundPort
    logger.info(`[MobileMcpService] Server started on port ${boundPort}`)
  }

  private teardownListener(): void {
    if (this.mcpListenerSub) {
      this.mcpListenerSub.remove()
      this.mcpListenerSub = null
    }
  }

  private resolveResponse(requestId: string, response: McpHttpResponseEnvelope): void {
    BaishouServer.resolveMcpHttpResponse(requestId, response)
  }

  private resolveJsonRpcError(
    requestId: string,
    code: number,
    message: string,
    id: unknown = null,
    acceptHeader?: string
  ): void {
    const body = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
    this.resolveResponse(
      requestId,
      this.formatHttpResponse(body, acceptHeader, { 'content-type': 'application/json' }, 400)
    )
  }

  private getSessionId(headers: Record<string, string>): string | undefined {
    return headers['mcp-session-id']
  }

  private negotiateProtocolVersion(clientVersion: unknown): string {
    if (
      typeof clientVersion === 'string' &&
      (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(clientVersion)
    ) {
      return clientVersion
    }
    return '2024-11-05'
  }

  private wantsEventStream(acceptHeader: string | undefined): boolean {
    return acceptHeader?.includes('text/event-stream') ?? false
  }

  private formatHttpResponse(
    jsonRpcBody: string,
    acceptHeader: string | undefined,
    extraHeaders: Record<string, string>,
    statusCode = 200
  ): McpHttpResponseEnvelope {
    if (this.wantsEventStream(acceptHeader) && jsonRpcBody) {
      return {
        statusCode,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
          ...extraHeaders
        },
        body: `event: message\ndata: ${jsonRpcBody}\n\n`
      }
    }

    return {
      statusCode,
      headers: {
        'content-type': 'application/json',
        ...extraHeaders
      },
      body: jsonRpcBody
    }
  }

  private async handleMcpHttpRequest(
    requestId: string,
    method: string,
    headers: Record<string, string>,
    body: string
  ): Promise<void> {
    const acceptHeader = headers['accept']

    try {
      const config = await this.getConfig()
      if (!isMcpRequestAuthorized(config, headers['authorization'])) {
        this.resolveJsonRpcError(
          requestId,
          -32001,
          'Unauthorized: invalid or missing MCP auth token',
          null,
          acceptHeader
        )
        return
      }

      if (method === 'GET') {
        // Streamable HTTP 可选 SSE 长连接；移动端暂不维持，返回 405 让客户端走 POST
        this.resolveResponse(requestId, {
          statusCode: 405,
          headers: { allow: 'GET, POST, DELETE' },
          body: ''
        })
        return
      }

      if (method === 'DELETE') {
        const sessionId = this.getSessionId(headers)
        if (sessionId) this.sessions.delete(sessionId)
        this.resolveResponse(requestId, { statusCode: 200, headers: {}, body: '' })
        return
      }

      if (method !== 'POST') {
        this.resolveJsonRpcError(requestId, -32000, 'Method not allowed', null, acceptHeader)
        return
      }

      const response = await this.processStreamablePost(body, headers)
      this.resolveResponse(requestId, response)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('[MobileMcpService] MCP request failed', e as Error)
      this.resolveJsonRpcError(requestId, -32700, `Error: ${message}`, null, acceptHeader)
    }
  }

  private async processStreamablePost(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<McpHttpResponseEnvelope> {
    const acceptHeader = headers['accept']

    if (!rawBody.trim()) {
      return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: '' }
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' }
        })
      }
    }

    const rpcMethod = payload.method as string | undefined
    const id = payload.id
    const params = (payload.params as Record<string, unknown>) || {}

    if (
      rpcMethod === 'notifications/initialized' ||
      rpcMethod === 'notifications/cancelled' ||
      (rpcMethod?.startsWith('notifications/') && id === undefined)
    ) {
      return { statusCode: 202, headers: {}, body: '' }
    }

    let sessionHeaders: Record<string, string> = {}

    if (rpcMethod === 'initialize') {
      const sessionId = Crypto.randomUUID()
      const protocolVersion = this.negotiateProtocolVersion(params.protocolVersion)
      this.sessions.set(sessionId, { protocolVersion })
      sessionHeaders = { 'mcp-session-id': sessionId }
    } else {
      const sessionId = this.getSessionId(headers)
      if (!sessionId || !this.sessions.has(sessionId)) {
        return {
          statusCode: 404,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32001,
              message: `Session not found: ${sessionId ?? '(missing)'}`
            }
          })
        }
      }
      sessionHeaders = { 'mcp-session-id': sessionId }
    }

    try {
      let result: unknown
      if (rpcMethod === 'initialize') {
        const { vaultName } = await this.resolveToolContext()
        const protocolVersion = this.negotiateProtocolVersion(params.protocolVersion)
        result = {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'BaiShou MCP Server', version: APP_VERSION },
          instructions: buildMcpInstructions(vaultName)
        }
      } else if (rpcMethod === 'tools/list') {
        result = { tools: await this.getAgentToolsMcp() }
      } else if (rpcMethod === 'tools/call') {
        result = await this.executeAgentTool(params)
      } else if (rpcMethod === 'ping') {
        result = {}
      } else {
        const body = JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' }
        })
        return this.formatHttpResponse(body, acceptHeader, sessionHeaders)
      }

      const body = JSON.stringify({ jsonrpc: '2.0', id, result })
      return this.formatHttpResponse(body, acceptHeader, sessionHeaders)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: `Error: ${message}` }
      })
      return this.formatHttpResponse(body, acceptHeader, sessionHeaders, 500)
    }
  }

  private toMcpInputSchema(parameters: unknown) {
    const raw = zodToJsonSchema(parameters as never, { target: 'jsonSchema7' }) as Record<
      string,
      unknown
    >
    return {
      type: 'object' as const,
      properties: (raw.properties as Record<string, unknown>) ?? {},
      required: Array.isArray(raw.required) ? raw.required : []
    }
  }

  private async getAgentToolsMcp() {
    const context = await this.resolveToolContext()
    return this.toolRegistry.getEnabledToolsRaw(context).map((tool) => ({
      name: `baishou_${tool.name}`,
      description: tool.description,
      inputSchema: this.toMcpInputSchema(tool.parameters)
    }))
  }

  private async executeAgentTool(params: Record<string, unknown>) {
    const rawName = String(params.name || '').replace(/^baishou_/, '')
    if (!rawName) {
      throw new Error('Missing tool name')
    }

    const tool = this.toolRegistry.get(rawName)
    if (!tool) throw new Error(`Tool not found: ${rawName}`)

    const context = await this.resolveToolContext()
    if (!this.toolRegistry.isToolEnabled(rawName, context)) {
      throw new Error(`Tool not available: ${rawName}`)
    }

    const result = await tool.execute((params.arguments as Record<string, unknown>) || {}, context)
    return formatMcpToolCallResult(typeof result === 'string' ? result : JSON.stringify(result))
  }
}
