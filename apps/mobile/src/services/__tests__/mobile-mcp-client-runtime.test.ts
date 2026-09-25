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
})
