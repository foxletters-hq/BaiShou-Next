import { ToolRegistry, type ToolContext, listBaishouMcpToolsForUi } from '@baishou/ai'
import type { SettingsManagerService } from '@baishou/core-mobile'
import type { McpServerConfig } from '@baishou/shared'
import { isMcpRequestAuthorized, logger } from '@baishou/shared'
import * as BaishouServer from 'expo-baishou-server'
import { APP_VERSION } from '../app-version'
import { MOBILE_MCP_ENABLED } from '../config/mobile-features'
import type { MobileMcpSdkBridge } from './mobile-mcp-sdk.bridge'
import type { MobileMcpSseBridge } from './mobile-mcp-sse.bridge'
import { isMcpMessagePath, isMcpSsePath } from './mobile-mcp-sse.util'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004,
  mcpAuthEnabled: false,
  mcpAutoApproveTools: false,
  disabledToolIds: []
}

export class MobileMcpService {
  private mcpListenerSub: { remove: () => void } | null = null
  private isRunning = false
  private activePort = 0
  private activeAuthToken: string | undefined = undefined
  private sdkBridge: MobileMcpSdkBridge | null = null
  private sseBridge: MobileMcpSseBridge | null = null
  private bridgesPromise: Promise<void> | null = null

  constructor(
    private readonly settingsManager: SettingsManagerService,
    private readonly toolRegistry: ToolRegistry,
    private readonly resolveToolContext: () => Promise<ToolContext>,
    private readonly resolveToolListContext?: () => Promise<ToolContext>
  ) {}

  /** MCP SDK 的 Server 继承链在 Hermes 上会拖垮启动，所以只在真正开服务时加载。 */
  private ensureBridges(): Promise<void> {
    if (this.sdkBridge && this.sseBridge) return Promise.resolve()
    if (!this.bridgesPromise) {
      this.bridgesPromise = (async () => {
        const [{ MobileMcpSdkBridge }, sseModule] = await Promise.all([
          import('./mobile-mcp-sdk.bridge'),
          import('./mobile-mcp-sse.bridge')
        ])
        this.sdkBridge = new MobileMcpSdkBridge(
          APP_VERSION,
          this.toolRegistry,
          this.resolveToolContext,
          this.resolveToolListContext
        )
        this.sseBridge = new sseModule.MobileMcpSseBridge(
          APP_VERSION,
          this.toolRegistry,
          this.resolveToolContext
        )
      })().catch((error) => {
        this.bridgesPromise = null
        throw error
      })
    }
    return this.bridgesPromise
  }

  async getConfig(): Promise<McpServerConfig> {
    return (
      (await this.settingsManager.get<McpServerConfig>('mcp_server_config')) ?? DEFAULT_MCP_CONFIG
    )
  }

  async getToolsList(): Promise<ReturnType<typeof listBaishouMcpToolsForUi>> {
    await this.ensureBridges()
    return this.sdkBridge!.getToolsList()
  }

  getActivePort(): number {
    return this.activePort
  }

  /**
   * 只有 MCP 仍实际持有原生 HTTP server 时才算运行中。
   * 局域网传输会复用同一个原生 server，MCP 被停掉/端口被接管后不能继续返回 true。
   */
  isServerRunning(): boolean {
    if (!this.isRunning || this.activePort <= 0) return false
    try {
      return BaishouServer.getServerPort() === this.activePort
    } catch {
      return false
    }
  }

  async start(): Promise<void> {
    if (!MOBILE_MCP_ENABLED) return
    const config = await this.getConfig()
    if (!config.mcpEnabled) return
    const port = config.mcpPort || DEFAULT_MCP_CONFIG.mcpPort
    const authToken =
      config.mcpAuthEnabled === true ? config.mcpAuthToken?.trim() || undefined : undefined
    if (this.isServerRunning() && this.activePort === port && this.activeAuthToken === authToken) {
      return
    }
    await this.startOnPort(config)
  }

  async stop(): Promise<void> {
    if (!this.isRunning && !this.sdkBridge && !this.sseBridge) return
    this.teardownListener()
    await this.sdkBridge?.closeAllSessions()
    await this.sseBridge?.closeAllSessions()
    // 局域网传输可能已经接管原生 server；此时停掉会把平台 HTTP 服务一起杀掉
    if (this.isServerRunning()) {
      BaishouServer.stopServer()
    }
    this.isRunning = false
    this.activePort = 0
    this.activeAuthToken = undefined
    logger.info('[MobileMcpService] Server stopped')
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  async applyConfig(config: McpServerConfig): Promise<void> {
    if (!MOBILE_MCP_ENABLED) return
    if (config.mcpEnabled) {
      const port = config.mcpPort || DEFAULT_MCP_CONFIG.mcpPort
      const authToken =
        config.mcpAuthEnabled === true ? config.mcpAuthToken?.trim() || undefined : undefined
      // 不能只看 this.isRunning：原生 server 可能已被 LAN 接管或启动失败
      if (
        this.isServerRunning() &&
        this.activePort === port &&
        this.activeAuthToken === authToken
      ) {
        return
      }
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

    await this.ensureBridges()
    const sdkBridge = this.sdkBridge!
    const sseBridge = this.sseBridge!

    this.teardownListener()
    await sdkBridge.closeAllSessions()
    await sseBridge.closeAllSessions()

    // 先清掉旧状态：startMcpServer 会先停掉现有原生 server，
    // 若新端口绑定失败，不能留下 isRunning=true / activePort 指向已死实例。
    this.isRunning = false
    this.activePort = 0
    this.activeAuthToken = undefined

    const port = config.mcpPort || DEFAULT_MCP_CONFIG.mcpPort
    const authToken =
      config.mcpAuthEnabled === true ? config.mcpAuthToken?.trim() || undefined : undefined
    const boundPort = BaishouServer.startMcpServer(port, authToken)
    if (boundPort <= 0) {
      throw new Error(`Failed to start MCP HTTP server on port ${port}`)
    }

    sdkBridge.setActivePort(boundPort)

    this.mcpListenerSub = BaishouServer.onMcpHttpRequest((event) => {
      void this.handleMcpHttpRequest(
        event.requestId,
        event.method,
        event.path || '/mcp',
        event.headers,
        event.body
      )
    })

    this.isRunning = true
    this.activePort = boundPort
    this.activeAuthToken = authToken
    logger.info(`[MobileMcpService] Server started on port ${boundPort} (/mcp + /sse)`)
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
    path: string,
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

      if (isMcpSsePath(path) || isMcpMessagePath(path)) {
        await this.ensureBridges()
        await this.sseBridge!.handleRequest(requestId, method, path, headers, body)
        return
      }

      await this.ensureBridges()
      await this.sdkBridge!.handleHttpRequest(requestId, method, headers, body, path ?? '/mcp')
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
