import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const appMock = vi.hoisted(() => ({
  isPackaged: false,
  name: '',
  paths: {
    appData: '/mock/AppData/Roaming',
    userData: '/mock/AppData/Roaming/Electron'
  },
  setName: vi.fn((name: string) => {
    appMock.name = name
  }),
  setPath: vi.fn((key: string, value: string) => {
    if (key === 'userData') {
      appMock.paths.userData = value
    }
  }),
  getPath: vi.fn((key: string) => {
    return appMock.paths[key as keyof typeof appMock.paths] ?? `/mock/${key}`
  })
}))

vi.mock('electron', () => ({
  app: appMock
}))

describe('configureDesktopAppIdentity', () => {
  beforeEach(() => {
    vi.resetModules()
    appMock.isPackaged = false
    appMock.name = ''
    appMock.paths.userData = '/mock/AppData/Roaming/Electron'
    appMock.setName.mockClear()
    appMock.setPath.mockClear()
    appMock.getPath.mockClear()
  })

  it('uses isolated userData and dev display name when not packaged', async () => {
    await import('../app-identity')

    expect(appMock.setName).toHaveBeenCalledWith('白守 Dev')
    expect(appMock.setPath).toHaveBeenCalledWith(
      'userData',
      join('/mock/AppData/Roaming', '白守 Dev')
    )
  })

  it('keeps stable identity when packaged', async () => {
    appMock.isPackaged = true
    await import('../app-identity')

    expect(appMock.setName).toHaveBeenCalledWith('白守')
    expect(appMock.setPath).not.toHaveBeenCalled()
  })
})
