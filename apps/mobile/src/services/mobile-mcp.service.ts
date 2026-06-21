import { ToolRegistry, type ToolContext, listBaishouMcpToolsForUi } from '@baishou/ai'
import type { SettingsManagerService } from '@baishou/core-mobile'
import type { McpServerConfig } from '@baishou/shared'
import { isMcpRequestAuthorized, logger } from '@baishou/shared'
import * as BaishouServer from 'expo-baishou-server'
import { APP_VERSION } from '../app-version'
import { MOBILE_MCP_ENABLED } from '../config/mobile-features'
import { MobileMcpSdkBridge } from './mobile-mcp-sdk.bridge'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004
}

export class MobileMcpService {
  private mcpListenerSub: { remove: () => void } | null = null
  private isRunning = false
  private activePort = 0
  private readonly sdkBridge: MobileMcpSdkBridge

  constructor(
    private readonly settingsManager: SettingsManagerService,
    private readonly toolRegistry: ToolRegistry,
    private readonly resolveToolContext: () => Promise<ToolContext>,
    private readonly resolveToolListContext?: () => Promise<ToolContext>
  ) {
    this.sdkBridge = new MobileMcpSdkBridge(
      APP_VERSION,
      toolRegistry,
      resolveToolContext,
      resolveToolListContext
    )
  }

  async getConfig(): Promise<McpServerConfig> {
    return (
      (await this.settingsManager.get<McpServerConfig>('mcp_server_config')) ?? DEFAULT_MCP_CONFIG
    )
  }

  async getToolsList(): Promise<ReturnType<typeof listBaishouMcpToolsForUi>> {
    return this.sdkBridge.getToolsList()
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
    await this.sdkBridge.closeAllSessions()
    BaishouServer.stopServer()
    this.isRunning = false
    this.activePort = 0
    logger.info('[MobileMcpService] Server stopped')
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

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
    await this.sdkBridge.closeAllSessions()

    const port = config.mcpPort || DEFAULT_MCP_CONFIG.mcpPort
    const authToken = config.mcpAuthToken?.trim() || undefined
    const boundPort = BaishouServer.startMcpServer(port, authToken)
    if (boundPort <= 0) {
      throw new Error(`Failed to start MCP HTTP server on port ${port}`)
    }

    this.sdkBridge.setActivePort(boundPort)

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

  private async handleMcpHttpRequest(
    requestId: string,
    method: string,
    headers: Record<string, string>,
    body: string
  ): Promise<void> {
    try {
      const config = await this.getConfig()
      if (!isMcpRequestAuthorized(config, headers['authorization'])) {
        BaishouServer.resolveMcpHttpResponse(requestId, {
          statusCode: 401,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32001, message: 'Unauthorized: invalid or missing MCP auth token' }
          })
        })
        return
      }

      await this.sdkBridge.handleHttpRequest(requestId, method, headers, body)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('[MobileMcpService] MCP request failed', e as Error)
      BaishouServer.resolveMcpHttpResponse(requestId, {
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: `Error: ${message}` }
        })
      })
    }
  }
}
