import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock/userData'),
    setName: vi.fn(),
    setPath: vi.fn()
  }
}))

describe('purgeDeviceLocalSettingsFromAgentDb', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('removes hotkey and mcp keys from shared agent db', async () => {
    const settingsRepo = {
      get: vi.fn(async (key: string) => {
        if (key === 'hotkey_config') return { hotkeyEnabled: true }
        if (key === 'mcp_server_config') return { mcpEnabled: true, mcpPort: 31004 }
        return null
      }),
      delete: vi.fn().mockResolvedValue(undefined)
    }
    const flush = vi.fn().mockResolvedValue(undefined)

    const { purgeDeviceLocalSettingsFromAgentDb } = await import('../desktop-device-settings.util')
    await purgeDeviceLocalSettingsFromAgentDb(settingsRepo as any, flush)

    expect(settingsRepo.delete).toHaveBeenCalledWith('hotkey_config')
    expect(settingsRepo.delete).toHaveBeenCalledWith('mcp_server_config')
    expect(flush).toHaveBeenCalled()
  })
})
