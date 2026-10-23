import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeServer = vi.hoisted(() => ({
  isBaishouServerAvailable: vi.fn(() => true),
  startMcpServer: vi.fn(() => 31004),
  getServerPort: vi.fn(() => 31004),
  stopServer: vi.fn(),
  onMcpHttpRequest: vi.fn(() => ({ remove: vi.fn() }))
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
})
