import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
  createBaishouMcpServer,
  listBaishouMcpToolsForUi,
  type ToolRegistry,
  type ToolContext
} from '@baishou/ai'
import { logger } from '@baishou/shared'
import * as ExpoCrypto from 'expo-crypto'
import * as BaishouServer from 'expo-baishou-server'
import type { McpHttpResponseEnvelope } from 'expo-baishou-server'
import {
  deliverMcpWebResponse,
  isInitializePayload,
  nanoEventToRequest,
  parseMcpRequestBody,
  type McpNativeResponseSink
} from './mobile-mcp-web-response.util'
import { MobileSseServerTransport } from './mobile-mcp-sse.transport'

export {
  buildMcpRequestUrl,
  deliverMcpWebResponse,
  isInitializePayload,
  nanoEventToRequest,
  parseMcpRequestBody,
  type McpNativeResponseSink
} from './mobile-mcp-web-response.util'

type StreamableMcpSession = {
  kind: 'streamable'
  transport: WebStandardStreamableHTTPServerTransport
  server: Server
}

type SseMcpSession = {
  kind: 'sse'
  transport: MobileSseServerTransport
  server: Server
}

type McpSession = StreamableMcpSession | SseMcpSession

const nativeSink: McpNativeResponseSink = {
  resolveMcpHttpResponse: BaishouServer.resolveMcpHttpResponse,
  beginMcpHttpStream: BaishouServer.beginMcpHttpStream,
  pushMcpHttpStreamChunk: BaishouServer.pushMcpHttpStreamChunk,
  endMcpHttpStream: BaishouServer.endMcpHttpStream
}

function pathnameOf(path: string): string {
  const q = path.indexOf('?')
  return q >= 0 ? path.slice(0, q) : path
}

function queryParam(path: string, key: string): string | undefined {
  const q = path.indexOf('?')
  if (q < 0) return undefined
  const params = new URLSearchParams(path.slice(q + 1))
  const value = params.get(key)
  return value?.trim() || undefined
}

export class MobileMcpSdkBridge {
  private readonly sessions = new Map<string, McpSession>()
  private readonly sessionChains = new Map<string, Promise<unknown>>()
  private readonly activeDeliveries = new Map<string, AbortController>()
  private activePort = 0

  constructor(
    private readonly appVersion: string,
    private readonly toolRegistry: ToolRegistry,
    private readonly resolveToolContext: () => Promise<ToolContext>,
    private readonly resolveToolListContext?: () => Promise<ToolContext>
  ) {}

  setActivePort(port: number): void {
    this.activePort = port
  }

  async getToolsList(): Promise<ReturnType<typeof listBaishouMcpToolsForUi>> {
    try {
      const context = await this.resolveToolContext()
      return listBaishouMcpToolsForUi(this.toolRegistry, context)
    } catch (e) {
      if (!this.resolveToolListContext) throw e
      logger.warn(
        '[MobileMcpSdkBridge] Full MCP context unavailable, using settings-only list',
        e as Error
      )
      const context = await this.resolveToolListContext()
      return listBaishouMcpToolsForUi(this.toolRegistry, context)
    }
  }

  async handleHttpRequest(
    requestId: string,
    method: string,
    headers: Record<string, string>,
    body: string,
    path = '/mcp'
  ): Promise<void> {
    const pathname = pathnameOf(path)
    if (pathname === '/sse' || pathname === '/sse/') {
      await this.handleSseConnect(requestId, method)
      return
    }
    if (pathname === '/message') {
      await this.handleSseMessage(requestId, method, path, headers, body)
      return
    }

    await this.handleStreamableRequest(requestId, method, headers, body)
  }

  async closeAllSessions(): Promise<void> {
    for (const controller of this.activeDeliveries.values()) {
      controller.abort()
    }
    this.activeDeliveries.clear()

    const sessionIds = [...this.sessions.keys()]
    await Promise.all(sessionIds.map((sid) => this.closeSession(sid)))
    this.sessionChains.clear()
  }

  private async handleSseConnect(requestId: string, method: string): Promise<void> {
    if (method !== 'GET') {
      this.resolvePlainError(requestId, 405, 'Method Not Allowed')
      return
    }

    let server: Server | null = null
    let transport: MobileSseServerTransport | null = null

    try {
      transport = new MobileSseServerTransport('/message')
      transport.bindStreamRequest(requestId)
      server = createBaishouMcpServer(this.appVersion, this.toolRegistry, () =>
        this.resolveToolContext()
      )

      const sessionId = transport.sessionId
      transport.onclose = () => {
        void this.closeSession(sessionId)
      }

      await server.connect(transport)
      this.sessions.set(sessionId, { kind: 'sse', transport, server })
      logger.info(`[MobileMcpSdkBridge] SSE session connected: ${sessionId}`)
    } catch (e) {
      logger.error('[MobileMcpSdkBridge] SSE connect failed', e as Error)
      const streamAlreadyOpen = transport?.hasStarted === true
      if (transport) {
        try {
          await transport.close()
        } catch {
          /* ignore */
        }
      }
      if (server) {
        try {
          await server.close()
        } catch {
          /* ignore */
        }
      }
      // beginMcpHttpStream 已占用原生 pending 时只能 end stream，不能再 resolve 固定响应
      if (!streamAlreadyOpen) {
        this.resolveJsonRpcError(
          requestId,
          500,
          -32603,
          `Error: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
  }

  private async handleSseMessage(
    requestId: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    body: string
  ): Promise<void> {
    if (method !== 'POST') {
      this.resolvePlainError(requestId, 405, 'Method Not Allowed')
      return
    }

    const sessionId = queryParam(path, 'sessionId')
    if (!sessionId) {
      this.resolvePlainError(requestId, 400, 'Missing sessionId')
      return
    }

    const session = this.sessions.get(sessionId)
    if (!session || session.kind !== 'sse') {
      logger.warn(`[MobileMcpSdkBridge] SSE session not found: ${sessionId}`)
      this.resolvePlainError(requestId, 404, 'Session not found')
      return
    }

    const contentType = headers['content-type'] ?? ''
    if (contentType && !contentType.toLowerCase().includes('application/json')) {
      this.resolvePlainError(requestId, 400, `Unsupported content-type: ${contentType}`)
      return
    }

    try {
      const parsedBody = parseMcpRequestBody(body)
      await this.runWithSessionLock(sessionId, async () => {
        await session.transport.handleMessage(parsedBody)
      })
      BaishouServer.resolveMcpHttpResponse(requestId, {
        statusCode: 202,
        headers: { 'content-type': 'text/plain' },
        body: 'Accepted'
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('[MobileMcpSdkBridge] SSE message failed', e as Error)
      this.resolvePlainError(requestId, 400, `Invalid message: ${message}`)
    }
  }

  private async handleStreamableRequest(
    requestId: string,
    method: string,
    headers: Record<string, string>,
    body: string
  ): Promise<void> {
    const sessionId = headers['mcp-session-id']
    const port = this.activePort || 31004
    const parsedBody = method === 'POST' ? parseMcpRequestBody(body) : undefined
    const delivery = new AbortController()
    this.activeDeliveries.set(requestId, delivery)

    try {
      if (sessionId) {
        await this.runWithSessionLock(sessionId, async () => {
          const session = this.sessions.get(sessionId)
          if (!session || session.kind !== 'streamable') {
            this.resolveJsonRpcError(requestId, 404, -32001, `Session not found: ${sessionId}`)
            return
          }

          const webRequest = nanoEventToRequest(method, headers, body, port)
          const response = await session.transport.handleRequest(webRequest, { parsedBody })
          await deliverMcpWebResponse(requestId, response, nativeSink, delivery.signal)
        })
        return
      }

      if (method !== 'POST' || !isInitializePayload(body)) {
        this.resolveJsonRpcError(
          requestId,
          400,
          -32000,
          'Bad Request: No valid session ID provided'
        )
        return
      }

      await this.handleInitializeRequest(
        requestId,
        method,
        headers,
        body,
        port,
        parsedBody,
        delivery.signal
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('[MobileMcpSdkBridge] MCP request failed', e as Error)
      this.resolveJsonRpcError(requestId, 500, -32603, `Error: ${message}`)
    } finally {
      this.activeDeliveries.delete(requestId)
    }
  }

  private async handleInitializeRequest(
    requestId: string,
    method: string,
    headers: Record<string, string>,
    body: string,
    port: number,
    parsedBody: unknown,
    signal: AbortSignal
  ): Promise<void> {
    let server: Server | null = null
    let transport: WebStandardStreamableHTTPServerTransport | null = null
    let sessionId: string | undefined

    try {
      server = createBaishouMcpServer(this.appVersion, this.toolRegistry, () =>
        this.resolveToolContext()
      )

      transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => ExpoCrypto.randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          if (server && transport) {
            this.sessions.set(sid, { kind: 'streamable', transport, server })
            logger.info(`[MobileMcpSdkBridge] Streamable session initialized: ${sid}`)
          }
        },
        onsessionclosed: (sid) => {
          void this.closeSession(sid)
        }
      })

      await server.connect(transport)
      sessionId = transport.sessionId

      if (sessionId && server && transport) {
        this.sessions.set(sessionId, { kind: 'streamable', transport, server })
      }

      const webRequest = nanoEventToRequest(method, headers, body, port)
      const response = await transport.handleRequest(webRequest, { parsedBody })
      await deliverMcpWebResponse(requestId, response, nativeSink, signal)
    } catch (e) {
      if (sessionId) {
        await this.closeSession(sessionId)
      } else {
        try {
          await transport?.close()
        } catch (closeErr) {
          logger.warn('[MobileMcpSdkBridge] transport close after init failure', closeErr as Error)
        }
        try {
          await server?.close()
        } catch (closeErr) {
          logger.warn('[MobileMcpSdkBridge] server close after init failure', closeErr as Error)
        }
      }
      throw e
    }
  }

  private runWithSessionLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.sessionChains.get(sessionId) ?? Promise.resolve()
    const current = previous
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (this.sessionChains.get(sessionId) === current) {
          this.sessionChains.delete(sessionId)
        }
      })
    this.sessionChains.set(sessionId, current)
    return current as Promise<T>
  }

  private async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    this.sessions.delete(sessionId)

    if (session.kind === 'sse') {
      session.transport.onclose = undefined
    }

    try {
      await session.transport.close()
    } catch (e) {
      logger.warn(`[MobileMcpSdkBridge] transport close failed for ${sessionId}`, e as Error)
    }
    try {
      await session.server.close()
    } catch (e) {
      logger.warn(`[MobileMcpSdkBridge] server close failed for ${sessionId}`, e as Error)
    }
    logger.info(
      `[MobileMcpSdkBridge] ${session.kind === 'sse' ? 'SSE' : 'Streamable'} session closed: ${sessionId}`
    )
  }

  private resolvePlainError(requestId: string, statusCode: number, message: string): void {
    BaishouServer.resolveMcpHttpResponse(requestId, {
      statusCode,
      headers: { 'content-type': 'text/plain' },
      body: message
    })
  }

  private resolveJsonRpcError(
    requestId: string,
    statusCode: number,
    code: number,
    message: string
  ): void {
    const envelope: McpHttpResponseEnvelope = {
      statusCode,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code, message }
      })
    }
    BaishouServer.resolveMcpHttpResponse(requestId, envelope)
  }
}
