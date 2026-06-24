import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const appMock = vi.hoisted(() => ({
  getPath: vi.fn(() => '/mock/userData')
}))

const fspMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}))

const isDesktopDevBuildMock = vi.hoisted(() => vi.fn(() => false))

vi.mock('electron', () => ({ app: appMock }))
vi.mock('fs/promises', () => fspMock)
vi.mock('../../app-identity', () => ({
  isDesktopDevBuild: isDesktopDevBuildMock
}))

describe('desktop-mcp-config.store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isDesktopDevBuildMock.mockReturnValue(false)
    appMock.getPath.mockReturnValue('/mock/userData')
    fspMock.mkdir.mockResolvedValue(undefined)
    fspMock.writeFile.mockResolvedValue(undefined)
  })

  it('reads config from userData file', async () => {
    const config = { mcpEnabled: true, mcpPort: 31004 }
    fspMock.readFile.mockResolvedValue(JSON.stringify(config))

    const { getDesktopMcpServerConfig } = await import('../desktop-mcp-config.store')
    await expect(getDesktopMcpServerConfig()).resolves.toEqual(config)
  })

  it('uses dev default port when no local file exists on dev build', async () => {
    isDesktopDevBuildMock.mockReturnValue(true)
    fspMock.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))

    const { getDesktopMcpServerConfig, DESKTOP_DEV_DEFAULT_MCP_PORT } = await import(
      '../desktop-mcp-config.store'
    )
    const config = await getDesktopMcpServerConfig()
    expect(config.mcpPort).toBe(DESKTOP_DEV_DEFAULT_MCP_PORT)
    expect(config.mcpEnabled).toBe(false)
  })

  it('migrates legacy shared settings without shared auth token', async () => {
    fspMock.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    const legacy = {
      mcpEnabled: true,
      mcpPort: 31004,
      mcpAuthToken: 'shared-token-should-not-migrate'
    }
    const settingsRepo = {
      get: vi.fn().mockResolvedValue(legacy),
      delete: vi.fn().mockResolvedValue(undefined)
    }

    const { migrateDesktopMcpConfigFromSharedSettings } = await import(
      '../desktop-mcp-config.store'
    )
    await migrateDesktopMcpConfigFromSharedSettings(settingsRepo as any)

    expect(fspMock.writeFile).toHaveBeenCalledWith(
      join('/mock/userData', 'device_mcp_server_config.json'),
      JSON.stringify({ mcpEnabled: true, mcpPort: 31004 }, null, 2),
      'utf8'
    )
    expect(settingsRepo.delete).toHaveBeenCalledWith('mcp_server_config')
  })
})
