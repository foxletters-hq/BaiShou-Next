import { describe, expect, it } from 'vitest'
import { MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE } from '@baishou/shared'
import {
  connectMcpHttpClient,
  listMcpHttpTools,
  withMcpHttpTimeout
} from '../mobile-mcp-http-client'

describe('withMcpHttpTimeout', () => {
  it('should return the value when the promise settles first', async () => {
    await expect(
      withMcpHttpTimeout(Promise.resolve('ok'), 50, MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE)
    ).resolves.toBe('ok')
  })

  it('should reject with the timeout message when the promise never settles', async () => {
    await expect(
      withMcpHttpTimeout(
        new Promise<string>(() => undefined),
        20,
        MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE
      )
    ).rejects.toThrow(MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE)
  })
})

describe('listMcpHttpTools', () => {
  it('should time out when tools/list never returns', async () => {
    const client = {
      listTools: () => new Promise(() => undefined)
    }
    await expect(listMcpHttpTools(client as never, 20)).rejects.toThrow(
      MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE
    )
  })
})

describe('connectMcpHttpClient', () => {
  it('should connect using injected streaming fetch function', async () => {
    const customFetch = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'))
      if (body.method === 'initialize') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: body.params?.protocolVersion || '2025-11-25',
              capabilities: {},
              serverInfo: { name: 'test-server', version: '1.0' }
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('', { status: 200 })
    }) as unknown as typeof fetch

    const { client } = await connectMcpHttpClient({
      url: 'http://127.0.0.1:31004/mcp',
      fetchFn: customFetch
    })
    expect(client).toBeDefined()
    await client.close()
  })

  it('should pick up globalThis.__expoFetch when available', async () => {
    const originalExpoFetch = (globalThis as any).__expoFetch
    const mockExpoFetch = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'))
      if (body.method === 'initialize') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: body.params?.protocolVersion || '2025-11-25',
              capabilities: {},
              serverInfo: { name: 'test-server', version: '1.0' }
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('', { status: 200 })
    }) as unknown as typeof fetch
    ;(globalThis as any).__expoFetch = mockExpoFetch

    try {
      const { client } = await connectMcpHttpClient({
        url: 'http://127.0.0.1:31004/mcp'
      })
      expect(client).toBeDefined()
      await client.close()
    } finally {
      if (originalExpoFetch !== undefined) {
        ;(globalThis as any).__expoFetch = originalExpoFetch
      } else {
        delete (globalThis as any).__expoFetch
      }
    }
  })
})
