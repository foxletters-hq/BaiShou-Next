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

vi.mock('electron', () => ({ app: appMock }))
vi.mock('fs/promises', () => fspMock)

describe('desktop-hotkey-config.store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    appMock.getPath.mockReturnValue('/mock/userData')
    fspMock.mkdir.mockResolvedValue(undefined)
    fspMock.writeFile.mockResolvedValue(undefined)
  })

  it('reads config from userData file', async () => {
    const config = { hotkeyEnabled: true, hotkeyModifier: 'Alt', hotkeyKey: 'Q' }
    fspMock.readFile.mockResolvedValue(JSON.stringify(config))

    const { getDesktopHotkeyConfig } = await import('../desktop-hotkey-config.store')
    await expect(getDesktopHotkeyConfig()).resolves.toEqual(config)
  })

  it('migrates legacy shared settings into userData once', async () => {
    fspMock.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    const legacy = { hotkeyEnabled: true, hotkeyModifier: 'Ctrl', hotkeyKey: 'S' }
    const settingsRepo = {
      get: vi.fn().mockResolvedValue(legacy),
      delete: vi.fn().mockResolvedValue(undefined)
    }

    const { migrateDesktopHotkeyConfigFromSharedSettings, getDesktopHotkeyConfig } = await import(
      '../desktop-hotkey-config.store'
    )
    await migrateDesktopHotkeyConfigFromSharedSettings(settingsRepo as any)

    expect(fspMock.writeFile).toHaveBeenCalledWith(
      join('/mock/userData', 'device_hotkey_config.json'),
      JSON.stringify(legacy, null, 2),
      'utf8'
    )
    expect(settingsRepo.delete).toHaveBeenCalledWith('hotkey_config')

    fspMock.readFile.mockResolvedValue(JSON.stringify(legacy))
    await expect(getDesktopHotkeyConfig()).resolves.toEqual(legacy)
  })
})
