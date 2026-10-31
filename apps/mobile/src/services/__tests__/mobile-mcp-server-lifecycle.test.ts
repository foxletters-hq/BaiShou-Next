import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeServer = vi.hoisted(() => ({
  isBaishouServerAvailable: vi.fn(() => true),
  startMcpServer: vi.fn(() => 31004),
  getServerPort: vi.fn(() => 31004),
  stopServer: vi.fn(),
  onMcpHttpRequest: vi.fn(() => ({ remove: vi.fn() })),
  resolveMcpHttpResponse: vi.fn(() => true),
  beginMcpHttpStream: vi.fn(() => true),
  pushMcpHttpStreamChunk: vi.fn(() => true),
  endMcpHttpStream: vi.fn(() => true)
}))

vi.mock('expo-baishou-server', () => nativeServer)

import type { McpServerConfig } from '@baishou/shared'
import { MobileMcpService } from '../mobile-mcp.service'

const CONFIG: McpServerConfig = {
  mcpEnabled: true,
  mcpPort: 31004,
  mcpAuthEnabled: false,
  mcpAutoApproveTools: false,
  disabledToolIds: []
}

function createService() {
  return new MobileMcpService(
    { get: vi.fn(async () => CONFIG) } as never,
    {} as never,
    async () => ({}) as never
  )
}

describe('MobileMcpService lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nativeServer.isBaishouServerAvailable.mockReturnValue(true)
    nativeServer.getServerPort.mockReturnValue(31004)
    nativeServer.startMcpServer.mockReturnValue(31004)
  })

  it('reports running only while the native server still belongs to MCP', () => {
    const service = createService()
    ;(service as any).isRunning = true
    ;(service as any).activePort = 31004

    nativeServer.getServerPort.mockReturnValue(31004)
    expect(service.isServerRunning()).toBe(true)

    nativeServer.getServerPort.mockReturnValue(0)
    expect(service.isServerRunning()).toBe(false)

    nativeServer.getServerPort.mockReturnValue(45678)
    expect(service.isServerRunning()).toBe(false)
  })

  it('restarts when the native server was lost even if isRunning was left true', async () => {
    const service = createService()
    ;(service as any).isRunning = true
    ;(service as any).activePort = 31004
    nativeServer.getServerPort.mockReturnValue(0)
    const startSpy = vi.spyOn(service as any, 'startOnPort').mockResolvedValue(undefined)

    await service.applyConfig(CONFIG)

    expect(startSpy).toHaveBeenCalledWith(CONFIG)
  })

  it('does not restart when MCP already owns the requested port', async () => {
    const service = createService()
    ;(service as any).isRunning = true
    ;(service as any).activePort = 31004
    nativeServer.getServerPort.mockReturnValue(31004)
    const startSpy = vi.spyOn(service as any, 'startOnPort').mockResolvedValue(undefined)

    await service.applyConfig(CONFIG)

    expect(startSpy).not.toHaveBeenCalled()
  })

  it('does not stop the native server when LAN has taken it over', async () => {
    const service = createService()
    ;(service as any).isRunning = true
    ;(service as any).activePort = 31004
    nativeServer.getServerPort.mockReturnValue(0)

    await service.stop()

    expect(nativeServer.stopServer).not.toHaveBeenCalled()
    expect(service.isServerRunning()).toBe(false)
  })

  it('stops the native server when MCP still owns it', async () => {
    const service = createService()
    ;(service as any).isRunning = true
    ;(service as any).activePort = 31004
    nativeServer.getServerPort.mockReturnValue(31004)

    await service.stop()

    expect(nativeServer.stopServer).toHaveBeenCalledTimes(1)
    expect(service.isServerRunning()).toBe(false)
  })

  it('clears the running state when binding the requested port fails', async () => {
    const service = createService()
    ;(service as any).isRunning = true
    ;(service as any).activePort = 31004
    ;(service as any).sdkBridge = {
      closeAllSessions: vi.fn(async () => undefined),
      setActivePort: vi.fn()
    }
    ;(service as any).sseBridge = {
      closeAllSessions: vi.fn(async () => undefined)
    }
    nativeServer.startMcpServer.mockReturnValue(-1)

    await expect((service as any).startOnPort(CONFIG)).rejects.toThrow(
      'Failed to start MCP HTTP server on port 31004'
    )

    expect((service as any).isRunning).toBe(false)
    expect((service as any).activePort).toBe(0)
  })

  it('routes GET /mcp without mcp-session-id to sseBridge as /sse and with mcp-session-id to sdkBridge', async () => {
    const service = createService()
    const sdkHandle = vi.fn(async () => undefined)
    const sseHandle = vi.fn(async () => undefined)
    ;(service as any).sdkBridge = {
      handleHttpRequest: sdkHandle,
      closeAllSessions: vi.fn(async () => undefined),
      setActivePort: vi.fn()
    }
    ;(service as any).sseBridge = {
      handleRequest: sseHandle,
      closeAllSessions: vi.fn(async () => undefined)
    }

    await (service as any).handleMcpHttpRequest(
      'req-sse-fallback',
      'GET',
      '/mcp',
      { accept: 'text/event-stream' },
      ''
    )

    expect(sseHandle).toHaveBeenCalledWith(
      'req-sse-fallback',
      'GET',
      '/sse',
      { accept: 'text/event-stream' },
      ''
    )
    expect(sdkHandle).not.toHaveBeenCalled()

    await (service as any).handleMcpHttpRequest(
      'req-streamable-get',
      'GET',
      '/mcp',
      { 'mcp-session-id': 'session-123', accept: 'text/event-stream' },
      ''
    )

    expect(sdkHandle).toHaveBeenCalledWith(
      'req-streamable-get',
      'GET',
      { 'mcp-session-id': 'session-123', accept: 'text/event-stream' },
      '',
      '/mcp'
    )
  })

  it('returns 405 Method Not Allowed on GET /mcp with an active streamable session without locking the session', async () => {
    const { MobileMcpSdkBridge } = await import('../mobile-mcp-sdk.bridge')
    const bridge = new MobileMcpSdkBridge(
      '1.0.0',
      { getAllRaw: () => [], get: () => undefined } as never,
      async () => ({}) as never
    )
    const transportHandleRequest = vi.fn()
    ;(bridge as any).sessions.set('session-active', {
      kind: 'streamable',
      transport: { handleRequest: transportHandleRequest, close: vi.fn() },
      server: { close: vi.fn() }
    })

    await bridge.handleHttpRequest(
      'req-get-405',
      'GET',
      { 'mcp-session-id': 'session-active', accept: 'text/event-stream' },
      '',
      '/mcp'
    )

    expect(transportHandleRequest).not.toHaveBeenCalled()
    expect(nativeServer.resolveMcpHttpResponse).toHaveBeenCalledWith('req-get-405', {
      statusCode: 405,
      headers: {
        allow: 'POST, DELETE',
        'content-type': 'text/plain; charset=utf-8'
      },
      body: 'Method Not Allowed'
    })
  })

  it('preserves ?vault= query parameter on GET /mcp fallback to sseBridge', async () => {
    const service = createService()
    const sdkHandle = vi.fn(async () => undefined)
    const sseHandle = vi.fn(async () => undefined)
    ;(service as any).sdkBridge = {
      handleHttpRequest: sdkHandle,
      closeAllSessions: vi.fn(async () => undefined),
      setActivePort: vi.fn()
    }
    ;(service as any).sseBridge = {
      handleRequest: sseHandle,
      closeAllSessions: vi.fn(async () => undefined)
    }

    await (service as any).handleMcpHttpRequest(
      'req-sse-vault',
      'GET',
      '/mcp?vault=vlt_work',
      { accept: 'text/event-stream' },
      ''
    )

    expect(sseHandle).toHaveBeenCalledWith(
      'req-sse-vault',
      'GET',
      '/sse?vault=vlt_work',
      { accept: 'text/event-stream' },
      ''
    )
    expect(sdkHandle).not.toHaveBeenCalled()

    await (service as any).handleMcpHttpRequest(
      'req-sse-path-vault-with-query',
      'GET',
      '/mcp/vlt_work?foo=1',
      { accept: 'text/event-stream' },
      ''
    )

    expect(sseHandle).toHaveBeenCalledWith(
      'req-sse-path-vault-with-query',
      'GET',
      '/sse/vlt_work?foo=1',
      { accept: 'text/event-stream' },
      ''
    )
  })

  it('returns 400 Parse error when POST /mcp body is malformed JSON', async () => {
    const { MobileMcpSdkBridge } = await import('../mobile-mcp-sdk.bridge')
    const bridge = new MobileMcpSdkBridge(
      '1.0.0',
      { getAllRaw: () => [], get: () => undefined } as never,
      async () => ({}) as never
    )

    await bridge.handleHttpRequest(
      'req-bad-json',
      'POST',
      { 'content-type': 'application/json' },
      '{malformed-json',
      '/mcp'
    )

    expect(nativeServer.resolveMcpHttpResponse).toHaveBeenCalledWith(
      'req-bad-json',
      expect.objectContaining({
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: expect.stringContaining('-32700')
      })
    )
  })
})
