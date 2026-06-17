import {
  ToolRegistry,
  type ToolContext,
  buildMcpInstructions,
  formatMcpToolCallResult
} from '@baishou/ai'
import type { SettingsManagerService } from '@baishou/core-mobile'
import type { McpServerConfig } from '@baishou/shared'
import { isMcpRequestAuthorized, logger } from '@baishou/shared'
import { APP_VERSION } from '../app-version'
import { zodToJsonSchema } from 'zod-to-json-schema'
import * as BaishouServer from 'expo-baishou-server'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004
}

type McpToolListItem = {
  name: string
  displayName?: string
  description: string
  category?: string
}

export class MobileMcpService {
  private mcpListenerSub: { remove: () => void } | null = null
  private isRunning = false
  private activePort = 0

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
    logger.info('[MobileMcpService] Server stopped')
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  /** Apply config after settings UI changes (persists externally). */
  async applyConfig(config: McpServerConfig): Promise<void> {
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

    this.mcpListenerSub = BaishouServer.onMcpHttpRequest(({ requestId, body, authorization }) => {
      void this.handleMcpRequest(requestId, body, authorization)
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

  private async handleMcpRequest(
    requestId: string,
    body: string,
    authorization?: string
  ): Promise<void> {
    try {
      const config = await this.getConfig()
      if (!isMcpRequestAuthorized(config, authorization)) {
        BaishouServer.resolveMcpHttpResponse(
          requestId,
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32001, message: 'Unauthorized: invalid or missing MCP auth token' }
          })
        )
        return
      }

      const responseBody = await this.processJsonRpc(body)
      BaishouServer.resolveMcpHttpResponse(requestId, responseBody)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('[MobileMcpService] MCP request failed', e as Error)
      BaishouServer.resolveMcpHttpResponse(
        requestId,
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: `Error: ${message}` }
        })
      )
    }
  }

  private async processJsonRpc(rawBody: string): Promise<string> {
    if (!rawBody.trim()) {
      return ''
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      })
    }

    const method = payload.method as string | undefined
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
      return ''
    }

    const id = payload.id
    const params = (payload.params as Record<string, unknown>) || {}

    try {
      let result: unknown
      if (method === 'initialize') {
        const { vaultName } = await this.resolveToolContext()
        result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'BaiShou MCP Server', version: APP_VERSION },
          instructions: buildMcpInstructions(vaultName)
        }
      } else if (method === 'tools/list') {
        result = { tools: await this.getAgentToolsMcp() }
      } else if (method === 'tools/call') {
        result = await this.executeAgentTool(params)
      } else if (method === 'ping') {
        result = {}
      } else {
        return JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' }
        })
      }

      return JSON.stringify({ jsonrpc: '2.0', id, result })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32700, message: `Error: ${message}` }
      })
    }
  }

  private async getAgentToolsMcp() {
    const context = await this.resolveToolContext()
    return this.toolRegistry.getEnabledToolsRaw(context).map((tool) => ({
      name: `baishou_${tool.name}`,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.parameters, { target: 'jsonSchema7' })
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
