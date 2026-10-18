import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMobileMcpClientConfig = vi.fn()
const setMobileMcpClientConfig = vi.fn()
const connectMcpHttpClient = vi.fn()

vi.mock('../mobile-mcp-client-config.store', () => ({
  getMobileMcpClientConfig: (...args: unknown[]) => getMobileMcpClientConfig(...args),
  setMobileMcpClientConfig: (...args: unknown[]) => setMobileMcpClientConfig(...args)
}))

vi.mock('../mobile-mcp-http-client', () => ({
  MCP_HTTP_PROBE_TIMEOUT_MS: 15_000,
  connectMcpHttpClient: (...args: unknown[]) => connectMcpHttpClient(...args),
  listMcpHttpTools: vi.fn(),
  callMcpHttpTool: vi.fn(),
  closeMcpHttpClient: vi.fn(),
  withMcpHttpTimeout: async <T>(promise: Promise<T>) => promise
}))

import {
  getMobileMcpClientRuntime,
  mobileExtraVercelToolsFactory,
  resetMobileMcpClientRuntimeForTest
} from '../mobile-mcp-client-runtime'

describe('mobile mcp client runtime', () => {
  beforeEach(() => {
    resetMobileMcpClientRuntimeForTest()
    getMobileMcpClientConfig.mockReset()
    setMobileMcpClientConfig.mockReset()
    connectMcpHttpClient.mockReset()
    getMobileMcpClientConfig.mockResolvedValue({ servers: [] })
    setMobileMcpClientConfig.mockImplementation(async (config: unknown) => config)
  })

  it('should reject sse and empty urls without opening a session', async () => {
    const runtime = getMobileMcpClientRuntime()
    await expect(runtime.testConnection('')).resolves.toMatchObject({
      ok: false,
      reason: 'empty'
    })
    await expect(runtime.testConnection('http://127.0.0.1:31004/sse')).resolves.toMatchObject({
      ok: false,
      reason: 'sse'
    })
    expect(connectMcpHttpClient).not.toHaveBeenCalled()
  })

  it('should skip extra tools when no enabled server is stored', async () => {
    const tools = await mobileExtraVercelToolsFactory({} as never)
    expect(tools).toEqual({})
    expect(connectMcpHttpClient).not.toHaveBeenCalled()
  })

  it('should load tools for enabled server and retry on callTool error', async () => {
    const { listMcpHttpTools, callMcpHttpTool, closeMcpHttpClient } =
      await import('../mobile-mcp-http-client')
    const fakeClient = { listTools: vi.fn(), callTool: vi.fn(), close: vi.fn() }
    const fakeTransport = { close: vi.fn() }
    vi.mocked(connectMcpHttpClient).mockResolvedValue({
      client: fakeClient as never,
      transport: fakeTransport as never
    })
    vi.mocked(listMcpHttpTools).mockResolvedValue([
      { name: 'get_weather', description: 'Get weather', inputSchema: {} }
    ])
    vi.mocked(callMcpHttpTool)
      .mockRejectedValueOnce(new Error('Transport is closed'))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Sunny 25C' }] })

    getMobileMcpClientConfig.mockResolvedValue({
      servers: [
        {
          id: 'server-1',
          name: 'WeatherSrv',
          url: 'http://127.0.0.1:3000/mcp',
          enabled: true
        }
      ]
    })

    const tools = await mobileExtraVercelToolsFactory({} as never)
    const toolIds = Object.keys(tools)
    expect(toolIds).toEqual(['mcp_call'])

    const vercelTool = tools['mcp_call'] as {
      description: string
      execute: (args: Record<string, unknown>) => Promise<string>
    }
    expect(vercelTool.description).toContain('get_weather')
    const result = await vercelTool.execute({ tool: 'get_weather', arguments: { city: 'Beijing' } })
    expect(result).toBe('Sunny 25C')
    expect(connectMcpHttpClient).toHaveBeenCalledTimes(2)
    expect(closeMcpHttpClient).toHaveBeenCalledTimes(1)
  })
})
