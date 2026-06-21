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

export {
  buildMcpRequestUrl,
  deliverMcpWebResponse,
  isInitializePayload,
  nanoEventToRequest,
  parseMcpRequestBody,
  type McpNativeResponseSink
} from './mobile-mcp-web-response.util'

type McpSession = {
  transport: WebStandardStreamableHTTPServerTransport
  server: Server
}

const nativeSink: McpNativeResponseSink = {
  resolveMcpHttpResponse: BaishouServer.resolveMcpHttpResponse,
  beginMcpHttpStream: BaishouServer.beginMcpHttpStream,
  pushMcpHttpStreamChunk: BaishouServer.pushMcpHttpStreamChunk,
  endMcpHttpStream: BaishouServer.endMcpHttpStream
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
    const resolve = this.resolveToolListContext ?? this.resolveToolContext
    const context = await resolve()
    return listBaishouMcpToolsForUi(this.toolRegistry, context)
  }

  async handleHttpRequest(
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
          if (!session) {
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

  async closeAllSessions(): Promise<void> {
    for (const controller of this.activeDeliveries.values()) {
      controller.abort()
    }
    this.activeDeliveries.clear()

    const sessionIds = [...this.sessions.keys()]
    await Promise.all(sessionIds.map((sid) => this.closeSession(sid)))
    this.sessionChains.clear()
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
            this.sessions.set(sid, { transport, server })
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
        this.sessions.set(sessionId, { transport, server })
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
    logger.info(`[MobileMcpSdkBridge] Streamable session closed: ${sessionId}`)
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
