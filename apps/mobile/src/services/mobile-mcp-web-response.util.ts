import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '@baishou/shared'
import type { McpHttpResponseEnvelope } from 'expo-baishou-server'

export type McpNativeResponseSink = {
  resolveMcpHttpResponse: (requestId: string, response: McpHttpResponseEnvelope) => boolean
  beginMcpHttpStream: (
    requestId: string,
    response: Pick<McpHttpResponseEnvelope, 'statusCode' | 'headers'>
  ) => boolean
  pushMcpHttpStreamChunk: (requestId: string, chunk: string) => boolean
  endMcpHttpStream: (requestId: string) => boolean
}

export function buildMcpRequestUrl(port: number): string {
  return `http://127.0.0.1:${port}/mcp`
}

export function nanoEventToRequest(
  method: string,
  headers: Record<string, string>,
  body: string,
  port: number
): Request {
  const reqHeaders = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    reqHeaders.set(key, value)
  }

  const init: RequestInit = { method, headers: reqHeaders }
  if (method === 'POST' && body) {
    init.body = body
  }

  return new Request(buildMcpRequestUrl(port), init)
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value
  })
  return record
}

export async function deliverMcpWebResponse(
  requestId: string,
  response: Response,
  sink: McpNativeResponseSink,
  signal?: AbortSignal
): Promise<void> {
  const headers = headersToRecord(response.headers)

  if (response.status === 202 && response.body == null) {
    sink.resolveMcpHttpResponse(requestId, {
      statusCode: 202,
      headers: {},
      body: ''
    })
    return
  }

  const contentType = response.headers.get('content-type') ?? ''
  const wantsEventStream = contentType.includes('text/event-stream')

  if (!wantsEventStream || response.body == null) {
    if (wantsEventStream && response.body == null) {
      logger.warn(
        '[MobileMcpSdkBridge] SSE response missing ReadableStream body; falling back to text()'
      )
    }
    const body = await response.text()
    if (signal?.aborted) return
    sink.resolveMcpHttpResponse(requestId, {
      statusCode: response.status,
      headers,
      body
    })
    return
  }

  const started = sink.beginMcpHttpStream(requestId, {
    statusCode: response.status,
    headers
  })
  if (!started) {
    throw new Error('Failed to begin MCP HTTP stream in native layer')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.length) continue

      const chunk = decoder.decode(value, { stream: true })
      if (!chunk) continue

      const pushed = sink.pushMcpHttpStreamChunk(requestId, chunk)
      if (!pushed) {
        logger.error(
          `[MobileMcpSdkBridge] Failed to push MCP stream chunk for request ${requestId}`
        )
        break
      }
    }

    if (!signal?.aborted) {
      const tail = decoder.decode()
      if (tail) {
        const pushed = sink.pushMcpHttpStreamChunk(requestId, tail)
        if (!pushed) {
          logger.error(
            `[MobileMcpSdkBridge] Failed to push final MCP stream chunk for request ${requestId}`
          )
        }
      }
    }
  } finally {
    sink.endMcpHttpStream(requestId)
    reader.releaseLock?.()
  }
}

export function parseMcpRequestBody(body: string): unknown | undefined {
  if (!body.trim()) return undefined
  return JSON.parse(body) as unknown
}

export function isInitializePayload(body: string): boolean {
  try {
    const payload = parseMcpRequestBody(body)
    if (!payload) return false
    if (Array.isArray(payload)) {
      return payload.some((item) => isInitializeRequest(item))
    }
    return isInitializeRequest(payload)
  } catch {
    return false
  }
}
