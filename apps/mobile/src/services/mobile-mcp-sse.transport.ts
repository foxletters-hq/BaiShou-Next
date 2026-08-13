import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { JSONRPCMessageSchema, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import * as ExpoCrypto from 'expo-crypto'
import * as BaishouServer from 'expo-baishou-server'
import { logger } from '@baishou/shared'

/**
 * 移动端 Legacy SSE 传输：协议对齐 SDK SSEServerTransport，
 * 通过原生 begin/push/end 流式 API 维持长连接。
 */
export class MobileSseServerTransport implements Transport {
  readonly sessionId: string
  private readonly endpointPath: string
  private streamRequestId: string | null = null
  private started = false
  private closed = false

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  constructor(endpointPath = '/message', sessionId?: string) {
    this.endpointPath = endpointPath
    this.sessionId = sessionId ?? ExpoCrypto.randomUUID()
  }

  /** 是否已向原生层打开 SSE 流（begin 成功后为 true） */
  get hasStarted(): boolean {
    return this.started
  }

  /** 绑定本次 GET /sse 对应的原生 requestId，并在 start() 时打开 SSE 流 */
  bindStreamRequest(requestId: string): void {
    this.streamRequestId = requestId
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('MobileSseServerTransport already started')
    }
    if (!this.streamRequestId) {
      throw new Error('MobileSseServerTransport missing stream request id')
    }

    const started = BaishouServer.beginMcpHttpStream(this.streamRequestId, {
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
    this.started = true

    const endpoint = `${this.endpointPath}?sessionId=${encodeURIComponent(this.sessionId)}`
    const pushed = BaishouServer.pushMcpHttpStreamChunk(
      this.streamRequestId,
      `event: endpoint\ndata: ${endpoint}\n\n`
    )
    if (!pushed) {
      throw new Error('Failed to push MCP SSE endpoint event')
    }
  }

  async handleMessage(message: unknown): Promise<void> {
    let parsed: JSONRPCMessage
    try {
      parsed = JSONRPCMessageSchema.parse(message)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.onerror?.(err)
      throw err
    }
    this.onmessage?.(parsed)
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.streamRequestId || this.closed) {
      throw new Error('Not connected')
    }
    const chunk = `event: message\ndata: ${JSON.stringify(message)}\n\n`
    const pushed = BaishouServer.pushMcpHttpStreamChunk(this.streamRequestId, chunk)
    if (!pushed) {
      logger.warn(`[MobileSseServerTransport] SSE push failed for ${this.sessionId}`)
      await this.close()
      throw new Error('SSE connection closed')
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    const requestId = this.streamRequestId
    this.streamRequestId = null
    if (requestId) {
      try {
        BaishouServer.endMcpHttpStream(requestId)
      } catch (e) {
        logger.warn('[MobileSseServerTransport] end stream failed', e as Error)
      }
    }
    this.onclose?.()
  }
}
