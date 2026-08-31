import { describe, expect, it, vi, beforeEach } from 'vitest'

const beginMcpHttpStream = vi.fn<(...args: unknown[]) => boolean>(() => true)
const pushMcpHttpStreamChunk = vi.fn<(...args: unknown[]) => boolean>(() => true)
const endMcpHttpStream = vi.fn<(...args: unknown[]) => boolean>(() => true)

vi.mock('expo-baishou-server', () => ({
  beginMcpHttpStream: (...args: unknown[]) => beginMcpHttpStream(...args),
  pushMcpHttpStreamChunk: (...args: unknown[]) => pushMcpHttpStreamChunk(...args),
  endMcpHttpStream: (...args: unknown[]) => endMcpHttpStream(...args)
}))

vi.mock('expo-crypto', () => ({
  randomUUID: () => 'sse-session-test-id'
}))

describe('MobileSseServerTransport', () => {
  beforeEach(() => {
    beginMcpHttpStream.mockClear()
    pushMcpHttpStreamChunk.mockClear()
    endMcpHttpStream.mockClear()
    beginMcpHttpStream.mockReturnValue(true)
    pushMcpHttpStreamChunk.mockReturnValue(true)
    endMcpHttpStream.mockReturnValue(true)
  })

  it('opens SSE stream and emits endpoint event on start', async () => {
    const { MobileSseServerTransport } = await import('../mobile-mcp-sse.transport')
    const transport = new MobileSseServerTransport('/message')
    transport.bindStreamRequest('req-1')

    await transport.start()

    expect(transport.hasStarted).toBe(true)
    expect(beginMcpHttpStream).toHaveBeenCalledWith('req-1', {
      statusCode: 200,
      headers: expect.objectContaining({
        'content-type': 'text/event-stream'
      })
    })
    expect(pushMcpHttpStreamChunk).toHaveBeenCalledWith(
      'req-1',
      'event: endpoint\ndata: /message?sessionId=sse-session-test-id\n\n'
    )
  })

  it('sends JSON-RPC messages as SSE data events', async () => {
    const { MobileSseServerTransport } = await import('../mobile-mcp-sse.transport')
    const transport = new MobileSseServerTransport('/message')
    transport.bindStreamRequest('req-2')
    await transport.start()

    await transport.send({ jsonrpc: '2.0', id: 1, result: { ok: true } })

    expect(pushMcpHttpStreamChunk).toHaveBeenLastCalledWith(
      'req-2',
      'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n'
    )
  })

  it('ends native stream on close', async () => {
    const { MobileSseServerTransport } = await import('../mobile-mcp-sse.transport')
    const transport = new MobileSseServerTransport('/message')
    transport.bindStreamRequest('req-3')
    await transport.start()
    await transport.close()

    expect(endMcpHttpStream).toHaveBeenCalledWith('req-3')
  })
})
