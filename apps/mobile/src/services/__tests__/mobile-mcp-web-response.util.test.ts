import { describe, it, expect, vi } from 'vitest'
import {
  deliverMcpWebResponse,
  isInitializePayload,
  nanoEventToRequest,
  type McpNativeResponseSink
} from '../mobile-mcp-web-response.util'

function createSink(): McpNativeResponseSink & {
  fixed: Array<{ requestId: string; response: { statusCode: number; body: string } }>
  streamChunks: string[]
} {
  const state = {
    fixed: [] as Array<{ requestId: string; response: { statusCode: number; body: string } }>,
    streamChunks: [] as string[]
  }

  return {
    fixed: state.fixed,
    streamChunks: state.streamChunks,
    resolveMcpHttpResponse: (requestId, response) => {
      state.fixed.push({ requestId, response })
      return true
    },
    beginMcpHttpStream: () => true,
    pushMcpHttpStreamChunk: (_requestId, chunk) => {
      state.streamChunks.push(chunk)
      return true
    },
    endMcpHttpStream: () => true
  }
}

describe('mobile-mcp-web-response.util', () => {
  it('detects initialize payloads', () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    })
    expect(isInitializePayload(body)).toBe(true)
    expect(isInitializePayload('{"method":"tools/list"}')).toBe(false)
  })

  it('builds web Request from nano event', () => {
    const request = nanoEventToRequest(
      'POST',
      { 'content-type': 'application/json', authorization: 'Bearer x' },
      '{"hello":true}',
      31004
    )
    expect(request.method).toBe('POST')
    expect(request.url).toBe('http://127.0.0.1:31004/mcp')
    expect(request.headers.get('authorization')).toBe('Bearer x')
  })

  it('delivers fixed JSON responses', async () => {
    const sink = createSink()
    const response = new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })

    await deliverMcpWebResponse('req-1', response, sink)

    expect(sink.fixed).toHaveLength(1)
    expect(sink.fixed[0]?.response.statusCode).toBe(200)
    expect(sink.fixed[0]?.response.body).toBe('{"ok":true}')
  })

  it('streams event-stream bodies chunk by chunk', async () => {
    const sink = createSink()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: message\n'))
        controller.enqueue(new TextEncoder().encode('data: {"ok":true}\n\n'))
        controller.close()
      }
    })
    const response = new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })

    await deliverMcpWebResponse('req-2', response, sink)

    expect(sink.fixed).toHaveLength(0)
    expect(sink.streamChunks.join('')).toContain('data: {"ok":true}')
  })

  it('falls back to text() when event-stream has no body stream', async () => {
    const sink = createSink()
    const response = new Response('event: message\ndata: {}\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })
    Object.defineProperty(response, 'body', { value: null })

    await deliverMcpWebResponse('req-3', response, sink)

    expect(sink.fixed).toHaveLength(1)
    expect(sink.fixed[0]?.response.body).toContain('data: {}')
  })

  it('stops streaming when chunk push fails', async () => {
    const sink = createSink()
    sink.pushMcpHttpStreamChunk = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('a'))
        controller.enqueue(new TextEncoder().encode('b'))
        controller.close()
      }
    })
    const response = new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })

    await deliverMcpWebResponse('req-4', response, sink)

    expect(sink.pushMcpHttpStreamChunk).toHaveBeenCalledTimes(2)
  })
})
