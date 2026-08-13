import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { createBaishouMcpServer, type ToolRegistry, type ToolContext } from '@baishou/ai'
import { logger } from '@baishou/shared'
import * as ExpoCrypto from 'expo-crypto'
import * as BaishouServer from 'expo-baishou-server'
import type { McpHttpResponseEnvelope } from 'expo-baishou-server'
import { parseMcpRequestBody, type McpNativeResponseSink } from './mobile-mcp-web-response.util'
import {
  buildSseEndpointEvent,
  buildSseMessageEvent,
  isMcpMessagePath,
  isMcpSsePath,
  parseSseSessionId
} from './mobile-mcp-sse.util'

export {
  buildSseEndpointEvent,
  buildSseMessageEvent,
  isMcpMessagePath,
  isMcpSsePath,
  parseSseSessionId
} from './mobile-mcp-sse.util'

const nativeSink: McpNativeResponseSink = {
  resolveMcpHttpResponse: BaishouServer.resolveMcpHttpResponse,
  beginMcpHttpStream: BaishouServer.beginMcpHttpStream,
  pushMcpHttpStreamChunk: BaishouServer.pushMcpHttpStreamChunk,
  endMcpHttpStream: BaishouServer.endMcpHttpStream
}

type SseSession = {
  sessionId: string
  requestId: string
  server: Server
  transport: MobileSseServerTransport
}

/** 与 MCP Legacy SSE 协议兼容的移动端 transport（不依赖 Node http.ServerResponse） */
export class MobileSseServerTransport implements Transport {
  sessionId: string
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private started = false
  private closed = false

  constructor(
    private readonly requestId: string,
    private readonly messageEndpoint: string,
    sessionId?: string
  ) {
    this.sessionId = sessionId || ExpoCrypto.randomUUID()
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('MobileSseServerTransport already started')
    }
    this.started = true

    const started = nativeSink.beginMcpHttpStream(this.requestId, {
      statusCode: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive'
      }
    })
    if (!started) {
      throw new Error('Failed to begin MCP SSE stream in native layer')
    }

    const ok = nativeSink.pushMcpHttpStreamChunk(
      this.requestId,
      buildSseEndpointEvent(this.sessionId, this.messageEndpoint)
    )
    if (!ok) {
      throw new Error('Failed to push MCP SSE endpoint event')
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed) {
      throw new Error('Not connected')
    }
    const ok = nativeSink.pushMcpHttpStreamChunk(this.requestId, buildSseMessageEvent(message))
    if (!ok) {
      throw new Error('Failed to push MCP SSE message event')
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    nativeSink.endMcpHttpStream(this.requestId)
    this.onclose?.()
  }

  async handlePostMessage(body: string): Promise<{ statusCode: number; body: string }> {
    if (!this.started || this.closed) {
      return { statusCode: 500, body: 'SSE connection not established' }
    }

    let parsed: unknown
    try {
      parsed = parseMcpRequestBody(body)
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)))
      return { statusCode: 400, body: String(error) }
    }

    try {
      const message = JSONRPCMessageSchema.parse(parsed)
      this.onmessage?.(message)
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)))
      return { statusCode: 400, body: `Invalid message: ${body}` }
    }

    return { statusCode: 202, body: 'Accepted' }
  }
}

export class MobileMcpSseBridge {
  private readonly sessions = new Map<string, SseSession>()

  constructor(
    private readonly appVersion: string,
    private readonly toolRegistry: ToolRegistry,
    private readonly resolveToolContext: () => Promise<ToolContext>
  ) {}

  async handleRequest(
    requestId: string,
    method: string,
    path: string,
    _headers: Record<string, string>,
    body: string
  ): Promise<void> {
    if (isMcpSsePath(path) && method === 'GET') {
      await this.openSseSession(requestId)
      return
    }

    if (isMcpMessagePath(path) && method === 'POST') {
      await this.handleMessagePost(requestId, path, body)
      return
    }

    this.resolvePlain(requestId, 404, 'Not Found')
  }

  async closeAllSessions(): Promise<void> {
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
    await Promise.all(
      sessions.map(async (session) => {
        try {
          await session.server.close()
        } catch (e) {
          logger.warn('[MobileMcpSseBridge] server close failed', e as Error)
        }
        try {
          await session.transport.close()
        } catch (e) {
          logger.warn('[MobileMcpSseBridge] transport close failed', e as Error)
        }
      })
    )
  }

  private async openSseSession(requestId: string): Promise<void> {
    const transport = new MobileSseServerTransport(requestId, '/message')
    const server = createBaishouMcpServer(this.appVersion, this.toolRegistry, () =>
      this.resolveToolContext()
    )

    transport.onclose = () => {
      this.sessions.delete(transport.sessionId)
      logger.info(`[MobileMcpSseBridge] SSE session closed: ${transport.sessionId}`)
    }

    await server.connect(transport)
    this.sessions.set(transport.sessionId, {
      sessionId: transport.sessionId,
      requestId,
      server,
      transport
    })
    logger.info(`[MobileMcpSseBridge] SSE session opened: ${transport.sessionId}`)
  }

  private async handleMessagePost(requestId: string, path: string, body: string): Promise<void> {
    const sessionId = parseSseSessionId(path)
    const session = sessionId ? this.sessions.get(sessionId) : undefined
    if (!session) {
      logger.warn(`[MobileMcpSseBridge] SSE session not found: ${sessionId ?? '(missing)'}`)
      this.resolvePlain(requestId, 404, 'Session not found')
      return
    }

    const result = await session.transport.handlePostMessage(body)
    const envelope: McpHttpResponseEnvelope = {
      statusCode: result.statusCode,
      headers: result.statusCode === 202 ? {} : { 'content-type': 'text/plain' },
      body: result.body
    }
    BaishouServer.resolveMcpHttpResponse(requestId, envelope)
  }

  private resolvePlain(requestId: string, statusCode: number, body: string): void {
    BaishouServer.resolveMcpHttpResponse(requestId, {
      statusCode,
      headers: { 'content-type': 'text/plain' },
      body
    })
  }
}
