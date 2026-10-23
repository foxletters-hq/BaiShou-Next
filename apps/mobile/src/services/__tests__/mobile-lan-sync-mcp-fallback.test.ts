import { beforeEach, describe, expect, it, vi } from 'vitest'

const server = vi.hoisted(() => ({
  isBaishouServerAvailable: vi.fn(() => true),
  startServer: vi.fn(() => 45678),
  startMcpServer: vi.fn(() => 45678),
  getServerPort: vi.fn(() => 0),
  stopServer: vi.fn(),
  startLanServer: vi.fn(() => 46000),
  getLanServerPort: vi.fn(() => 0),
  stopLanServer: vi.fn(),
  supportsIndependentLanServer: vi.fn(() => false),
  onHttpServerPortChanged: vi.fn(() => ({ remove: vi.fn() })),
  onFileReceived: vi.fn(() => ({ remove: vi.fn() })),
  onLanUploadStarted: vi.fn(() => ({ remove: vi.fn() })),
  onLanUploadProgress: vi.fn(() => ({ remove: vi.fn() })),
  onLanUploadFailed: vi.fn(() => ({ remove: vi.fn() }))
}))

vi.mock('expo-baishou-server', () => server)
vi.mock('expo-network', () => ({
  getIpAddressAsync: vi.fn(async () => '192.168.1.20')
}))
vi.mock('react-native-zeroconf', () => {
  class Zeroconf {
    on = vi.fn()
    scan = vi.fn()
    stop = vi.fn()
    publishService = vi.fn()
    unpublishService = vi.fn()
  }
  return {
    default: Zeroconf,
    ImplType: { NSD: 'NSD', DNSSD: 'DNSSD' }
  }
})
vi.mock('../lan-discovery-permission.service', () => ({
  ensureLanDiscoveryPermissions: vi.fn(async () => true)
}))
vi.mock('../lan-file-transfer', () => ({
  sendLanFile: vi.fn()
}))

import { MobileLanSyncService } from '../lan-sync.service'

function createService(isMcpRunning: () => boolean) {
  return new MobileLanSyncService({} as never, {} as never, 'device-test', isMcpRunning)
}

describe('MobileLanSyncService MCP fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    server.isBaishouServerAvailable.mockReturnValue(true)
    server.supportsIndependentLanServer.mockReturnValue(false)
    server.startLanServer.mockReturnValue(46000)
    server.getServerPort.mockReturnValue(0)
    server.getLanServerPort.mockReturnValue(0)
    server.startServer.mockImplementation(() => {
      server.getServerPort.mockReturnValue(45678)
      return 45678
    })
  })

  it('uses an independent LAN server and leaves MCP completely alone', async () => {
    server.supportsIndependentLanServer.mockReturnValue(true)
    const service = createService(() => true)

    const conn = await service.startBroadcasting()

    expect(conn).toMatchObject({ ip: '192.168.1.20', port: 46000 })
    expect(server.startLanServer).toHaveBeenCalledWith(0)
    expect(server.startServer).not.toHaveBeenCalled()
    expect(server.onHttpServerPortChanged).not.toHaveBeenCalled()

    await service.stopBroadcasting()

    expect(server.stopLanServer).toHaveBeenCalledTimes(1)
    expect(server.stopServer).not.toHaveBeenCalled()
  })

  it('starts its own server instead of throwing when MCP claims running but the native port is gone', async () => {
    const service = createService(() => true)

    const conn = await service.startBroadcasting()

    expect(conn).toMatchObject({ ip: '192.168.1.20', port: 45678 })
    expect(server.startServer).toHaveBeenCalledWith(0)
    expect(server.stopServer).not.toHaveBeenCalled()

    await service.stopBroadcasting()
  })

  it('reuses the MCP server when it still owns the native port', async () => {
    server.getServerPort.mockReturnValue(31004)
    const service = createService(() => true)

    const conn = await service.startBroadcasting()

    expect(conn).toMatchObject({ ip: '192.168.1.20', port: 31004 })
    expect(server.startServer).not.toHaveBeenCalled()

    await service.stopBroadcasting()
    expect(server.stopServer).not.toHaveBeenCalled()
  })

  it('waits briefly for MCP to publish its port instead of taking over immediately', async () => {
    server.getServerPort.mockReturnValueOnce(0).mockReturnValue(31004)
    const service = createService(() => true)

    const conn = await service.startBroadcasting()

    expect(conn).toMatchObject({ port: 31004 })
    expect(server.startServer).not.toHaveBeenCalled()

    await service.stopBroadcasting()
  })

  it('stops the native server on page close when LAN owns it', async () => {
    const service = createService(() => false)
    await service.startBroadcasting()

    server.getServerPort.mockReturnValue(45678)
    await service.stopBroadcasting()

    expect(server.stopServer).toHaveBeenCalledTimes(1)
  })

  it('does not stop the native server when MCP has taken it over', async () => {
    let mcpRunning = false
    const service = createService(() => mcpRunning)
    await service.startBroadcasting()

    // MCP 在 LAN 页面打开后接管了同一个端口，但页面退出时端口事件尚未送达
    mcpRunning = true
    server.getServerPort.mockReturnValue(45678)
    await service.stopBroadcasting()

    expect(server.stopServer).not.toHaveBeenCalled()
  })
})
