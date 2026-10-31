import express from 'express'
import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { APP_VERSION } from '../../app-version'
// @ts-ignore
import { Server as HttpServer } from 'http'
import type { ToolRegistry, ToolContext } from '@baishou/ai'
import { createBaishouMcpServer } from '@baishou/ai'
import { extractMcpTargetVault, isMcpRequestAuthorized, logger } from '@baishou/shared'
import { getDesktopMcpServerConfig } from './desktop-mcp-config.store'
import { buildMcpToolContext } from '../ipc/agent-helpers'

interface SseMcpSession {
  server: Server
  transport: SSEServerTransport
}

export const DEFAULT_MCP_START_RETRY_DELAYS_MS = [500, 1000, 2000] as const

export interface McpStartOptions {
  retryDelaysMs?: readonly number[]
}

export class McpService {
  private readonly app = express()
  private httpServer: HttpServer | null = null
  private isRunning = false
  private startPromise: Promise<void> | null = null
  private readonly sseSessions = new Map<string, SseMcpSession>()
  private readonly streamableTransports = new Map<string, StreamableHTTPServerTransport>()

  get running(): boolean {
    return this.isRunning && Boolean(this.httpServer?.listening)
  }

  constructor(
    private readonly toolRegistry?: ToolRegistry,
    private readonly resolveToolContext: (
      targetVault?: string
    ) => Promise<ToolContext> = buildMcpToolContext
  ) {
    this.app.use(express.json())
    this.app.use(this.corsMiddleware)
    this.setupRoutes()
  }

  private corsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, mcp-session-id, Mcp-Session-Id, Last-Event-ID, mcp-protocol-version, MCP-Protocol-Version'
    )
    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
      return
    }
    next()
  }

  private async ensureAuthorized(req: express.Request, res: express.Response): Promise<boolean> {
    const config = await getDesktopMcpServerConfig()
    const authHeader = req.headers.authorization
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader
    if (isMcpRequestAuthorized(config, headerValue)) return true

    if (!res.headersSent) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: invalid or missing MCP auth token' },
        id: null
      })
    }
    return false
  }

  private createMcpServer(targetVault?: string): Server {
    return createBaishouMcpServer(APP_VERSION, this.toolRegistry, () =>
      this.resolveToolContext(targetVault)
    )
  }

  private resolveRequestTargetVault(req: express.Request): string | undefined {
    return extractMcpTargetVault(req.originalUrl || req.url)
  }

  private setupRoutes() {
    // Streamable HTTP (Cursor / modern MCP clients) — primary endpoint
    this.app.post(['/mcp', '/mcp/:vault'], async (req, res) => {
      await this.handleStreamablePost(req, res)
    })
    this.app.get(['/mcp', '/mcp/:vault'], async (req, res) => {
      await this.handleStreamableGet(req, res)
    })
    this.app.delete(['/mcp', '/mcp/:vault'], async (req, res) => {
      await this.handleStreamableDelete(req, res)
    })

    // Legacy SSE transport (optional; session id must match SDK transport.sessionId)
    this.app.get(['/sse', '/sse/:vault'], async (req, res) => {
      await this.handleSseConnect(req, res)
    })

    this.app.post('/message', async (req, res) => {
      if (!(await this.ensureAuthorized(req, res))) return
      const sessionId = req.query.sessionId as string
      const session = sessionId ? this.sseSessions.get(sessionId) : undefined

      if (!session) {
        logger.warn(`[McpService] SSE session not found: ${sessionId ?? '(missing)'}`)
        res.status(404).send('Session not found')
        return
      }

      // express.json() 已消费 body 流；必须把 parsed body 传给 SDK，否则会 400 stream is not readable
      await session.transport.handlePostMessage(req, res, req.body)
    })
  }

  private async handleSseConnect(req: express.Request, res: express.Response) {
    if (!(await this.ensureAuthorized(req, res))) return
    const targetVault = this.resolveRequestTargetVault(req)
    const transport = new SSEServerTransport('/message', res)
    const server = this.createMcpServer(targetVault)

    await server.connect(transport)
    this.sseSessions.set(transport.sessionId, { server, transport })

    res.on('close', () => {
      this.sseSessions.delete(transport.sessionId)
    })
  }

  private getStreamableSessionId(req: express.Request): string | undefined {
    const headerSessionId = req.headers['mcp-session-id']
    const raw = Array.isArray(headerSessionId) ? headerSessionId[0] : headerSessionId
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined
  }

  private async handleStreamablePost(req: express.Request, res: express.Response) {
    if (!(await this.ensureAuthorized(req, res))) return

    const sessionId = this.getStreamableSessionId(req)

    try {
      if (sessionId) {
        const transport = this.streamableTransports.get(sessionId)
        if (!transport) {
          res.status(404).json({
            jsonrpc: '2.0',
            error: { code: -32001, message: `Session not found: ${sessionId}` },
            id: null
          })
          return
        }
        await transport.handleRequest(req, res, req.body)
        return
      }

      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null
        })
        return
      }

      const targetVault = this.resolveRequestTargetVault(req)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          this.streamableTransports.set(sid, transport)
          logger.info(
            `[McpService] Streamable session initialized: ${sid}${targetVault ? ` (vault=${targetVault})` : ''}`
          )
        },
        onsessionclosed: (sid) => {
          this.streamableTransports.delete(sid)
          logger.info(`[McpService] Streamable session closed: ${sid}`)
        }
      })

      const server = this.createMcpServer(targetVault)
      await server.connect(transport)
      if (transport.sessionId) {
        this.streamableTransports.set(transport.sessionId, transport)
      }

      await transport.handleRequest(req, res, req.body)
    } catch (e: any) {
      logger.error('[McpService] Streamable POST failed:', e)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        })
      }
    }
  }

  private async handleStreamableGet(req: express.Request, res: express.Response) {
    if (!(await this.ensureAuthorized(req, res))) return

    const sessionId = this.getStreamableSessionId(req)
    if (!sessionId) {
      // 兼容外部客户端将复制的 /mcp 地址配置为 Legacy SSE 连接类型的场景（发送无 mcp-session-id 的 GET /mcp）
      await this.handleSseConnect(req, res)
      return
    }

    const transport = this.streamableTransports.get(sessionId)
    if (!transport) {
      res.status(404).send('Session not found')
      return
    }

    await transport.handleRequest(req, res)
  }

  private async handleStreamableDelete(req: express.Request, res: express.Response) {
    if (!(await this.ensureAuthorized(req, res))) return

    const sessionId = this.getStreamableSessionId(req)
    if (!sessionId) {
      res.status(400).send('Invalid or missing session ID')
      return
    }

    const transport = this.streamableTransports.get(sessionId)
    if (!transport) {
      res.status(404).send('Session not found')
      return
    }

    try {
      await transport.handleRequest(req, res)
    } catch (e: any) {
      logger.error('[McpService] Streamable DELETE failed:', e)
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination')
      }
    }
  }

  private listenOnce(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let server: HttpServer | null = null
      let settled = false

      const onStartupError = (err: Error) => {
        if (settled) return
        settled = true
        if (server) {
          server.removeListener('listening', onListening)
          server.removeListener('error', onStartupError)
          try {
            server.close()
          } catch {
            // 忽略未成功监听时的关闭异常
          }
        }
        if (this.httpServer === server) {
          this.httpServer = null
        }
        this.isRunning = false
        reject(err)
      }

      // Express 5 的 app.listen(port, host, callback) 会将 callback 同时注册到 server.once('error', callback)，
      // 当端口占用时 callback 会收到 err 参数且 server.listening 为 false。
      const onListening = (err?: Error) => {
        if (err) {
          onStartupError(err)
          return
        }
        if (settled || !server) return
        const activeServer = server
        if (!activeServer.listening) {
          onStartupError(
            new Error(`MCP HTTP server failed to enter listening state on port ${port}`)
          )
          return
        }
        settled = true
        activeServer.removeListener('error', onStartupError)
        this.httpServer = activeServer
        this.isRunning = true

        activeServer.on('close', () => {
          this.isRunning = false
          if (this.httpServer === activeServer) {
            this.httpServer = null
          }
        })

        activeServer.on('error', (runtimeErr) => {
          logger.error('[McpService] Runtime HTTP server error:', runtimeErr)
          this.isRunning = false
          if (this.httpServer === activeServer && !activeServer.listening) {
            this.httpServer = null
          }
        })

        const bound = activeServer.address()
        const actualPort = typeof bound === 'object' && bound ? bound.port : port
        logger.info(`[McpService] Server started on http://0.0.0.0:${actualPort}/mcp (SSE: /sse)`)
        resolve()
      }

      try {
        server = this.app.listen(port, '0.0.0.0', onListening)
        this.httpServer = server
        server.once('error', onStartupError)
      } catch (e) {
        onStartupError(e as Error)
      }
    })
  }

  private async startWithRetry(retryDelaysMs: readonly number[]): Promise<void> {
    if (this.running) return

    if (this.httpServer && !this.httpServer.listening) {
      try {
        this.httpServer.closeAllConnections?.()
        this.httpServer.close()
      } catch {
        // 忽略残留实例清理异常
      }
      this.httpServer = null
    }
    this.isRunning = false

    const config = await getDesktopMcpServerConfig()
    const port = config.mcpPort || 31004
    const totalAttempts = retryDelaysMs.length + 1

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      try {
        await this.listenOnce(port)
        return
      } catch (e: any) {
        this.isRunning = false
        this.httpServer = null

        const delayMs = retryDelaysMs[attempt - 1]
        if (delayMs !== undefined) {
          const code = e?.code ? ` (${e.code})` : ''
          logger.warn(
            `[McpService] Failed to listen on port ${port}${code} (attempt ${attempt}/${totalAttempts}), retrying in ${delayMs}ms...`
          )
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          if (this.running) return
          continue
        }

        logger.error(`[McpService] Failed to start on port ${port}`, e as any)
        throw e
      }
    }
  }

  async start(options?: McpStartOptions): Promise<void> {
    if (this.running) return
    if (this.startPromise) return this.startPromise

    const retryDelaysMs = options?.retryDelaysMs ?? DEFAULT_MCP_START_RETRY_DELAYS_MS
    this.startPromise = this.startWithRetry(retryDelaysMs).finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  async stop(): Promise<void> {
    if (!this.isRunning && !this.httpServer) return

    for (const [_id, session] of this.sseSessions.entries()) {
      try {
        await session.server.close()
      } catch (e) {}
    }
    this.sseSessions.clear()

    for (const transport of this.streamableTransports.values()) {
      try {
        await transport.close()
      } catch (e) {}
    }
    this.streamableTransports.clear()

    const server = this.httpServer
    this.isRunning = false
    this.httpServer = null
    if (!server) return

    return new Promise((resolve) => {
      try {
        server.closeAllConnections?.()
        if (!server.listening) {
          logger.info(`[McpService] Server stopped`)
          resolve()
          return
        }
        server.close(() => {
          this.isRunning = false
          if (this.httpServer === server) {
            this.httpServer = null
          }
          logger.info(`[McpService] Server stopped`)
          resolve()
        })
      } catch {
        resolve()
      }
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }
}
