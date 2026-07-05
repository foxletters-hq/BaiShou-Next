import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UpdateStatus } from '../updater.types'
import { UpdateTimeoutError, UpdateCheckError } from '../updater.errors'

const electronAppMock = vi.hoisted(() => ({
  getVersion: vi.fn(() => 'Next-1.0.4'),
  isPackaged: false
}))

const channelMock = vi.hoisted(() => ({
  fetchReleaseChannelManifest: vi.fn(),
  isAppVersionNewer: vi.fn((latest: string, current: string) => latest > current),
  releaseTagToPageUrl: vi.fn((tag: string) => `https://github.com/example/releases/tag/${tag}`)
}))

const shellMock = vi.hoisted(() => ({
  openExternal: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    autoDownload: false,
    autoInstallOnAppQuit: false,
    logger: null,
    currentVersion: 'Next-1.0.4'
  }
}))

vi.mock('electron', () => ({
  app: electronAppMock,
  shell: shellMock,
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

vi.mock('@baishou/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@baishou/shared')>()
  return {
    ...actual,
    fetchReleaseChannelManifest: channelMock.fetchReleaseChannelManifest,
    isAppVersionNewer: channelMock.isAppVersionNewer,
    releaseTagToPageUrl: channelMock.releaseTagToPageUrl
  }
})

vi.mock('../../../app-version', () => ({
  APP_VERSION: 'Next-1.0.4',
  APP_VERSION_NUMBER: '1.0.4'
}))

describe('UpdaterService', () => {
  let updaterService: any
  let mockAutoUpdater: any

  beforeEach(async () => {
    vi.clearAllMocks()
    channelMock.isAppVersionNewer.mockImplementation(
      (latest: string, current: string) => latest > current
    )
    const { autoUpdater } = await import('electron-updater')
    mockAutoUpdater = autoUpdater

    const { UpdaterService } = await import('../updater.service')
    updaterService = new UpdaterService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getCurrentVersion', () => {
    it('should return current version', () => {
      const version = updaterService.getCurrentVersion()
      expect(version).toBe('Next-1.0.4')
    })
  })

  describe('checkForUpdates', () => {
    beforeEach(() => {
      electronAppMock.isPackaged = true
    })

    it('should return hasUpdate true when channel has newer windows build', async () => {
      channelMock.fetchReleaseChannelManifest.mockResolvedValue({
        windows: {
          version: '2.0.0',
          tag: 'desktop/v2.0.0',
          downloadUrl: 'https://example.com/setup.exe',
          artifact: 'BaiShou-Windows-Setup.exe'
        }
      })
      channelMock.isAppVersionNewer.mockReturnValue(true)

      const result = await updaterService.checkForUpdates()

      expect(result.hasUpdate).toBe(true)
      expect(result.updateInfo?.version).toBe('2.0.0')
      expect(result.updateInfo?.releaseUrl).toBe('https://example.com/setup.exe')
      expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
    })

    it('should return hasUpdate false when channel windows is up to date', async () => {
      channelMock.fetchReleaseChannelManifest.mockResolvedValue({
        windows: {
          version: '1.0.4',
          tag: 'desktop/v1.0.4',
          downloadUrl: 'https://example.com/setup.exe',
          artifact: 'BaiShou-Windows-Setup.exe'
        }
      })
      channelMock.isAppVersionNewer.mockReturnValue(false)

      const result = await updaterService.checkForUpdates()

      expect(result.hasUpdate).toBe(false)
      expect(result.updateInfo).toBeNull()
    })

    it('falls back to electron-updater when channel fetch fails', async () => {
      channelMock.fetchReleaseChannelManifest.mockRejectedValue(new Error('Network error'))

      mockAutoUpdater.checkForUpdates.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: {
          version: '2.0.0',
          releaseNotes: 'New features',
          releaseDate: '2026-05-13'
        }
      })

      const result = await updaterService.checkForUpdates()

      expect(result.hasUpdate).toBe(true)
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    })

    it('should throw UpdateTimeoutError when check times out', async () => {
      channelMock.fetchReleaseChannelManifest.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 15000))
      )

      await expect(updaterService.checkForUpdates()).rejects.toThrow(UpdateTimeoutError)
    }, 15000)

    it('should throw UpdateCheckError when electron fallback fails', async () => {
      channelMock.fetchReleaseChannelManifest.mockRejectedValue(new Error('Network error'))
      mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('Network error'))

      await expect(updaterService.checkForUpdates()).rejects.toThrow(UpdateCheckError)
    })
  })

  describe('downloadUpdate', () => {
    it('opens channel download url in browser when available', async () => {
      electronAppMock.isPackaged = true
      channelMock.fetchReleaseChannelManifest.mockResolvedValue({
        windows: {
          version: '2.0.0',
          tag: 'desktop/v2.0.0',
          downloadUrl: 'https://example.com/setup.exe',
          artifact: 'BaiShou-Windows-Setup.exe'
        }
      })
      channelMock.isAppVersionNewer.mockReturnValue(true)

      await updaterService.checkForUpdates()
      await updaterService.downloadUpdate()

      expect(shellMock.openExternal).toHaveBeenCalledWith('https://example.com/setup.exe')
      expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled()
    })

    it('should call autoUpdater.downloadUpdate when no channel url', async () => {
      mockAutoUpdater.downloadUpdate.mockResolvedValue(undefined)

      await updaterService.downloadUpdate()

      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled()
    })

    it('should throw UpdateCheckError when download fails', async () => {
      mockAutoUpdater.downloadUpdate.mockRejectedValue(new Error('Download failed'))

      await expect(updaterService.downloadUpdate()).rejects.toThrow(UpdateCheckError)
    })
  })

  describe('quitAndInstall', () => {
    it('should call autoUpdater.quitAndInstall', () => {
      updaterService.quitAndInstall()

      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
    })
  })

  describe('setAutoCheck and getAutoCheck', () => {
    it('should set and get auto check status', () => {
      updaterService.setAutoCheck(true)
      expect(updaterService.getAutoCheck()).toBe(true)

      updaterService.setAutoCheck(false)
      expect(updaterService.getAutoCheck()).toBe(false)
    })
  })

  describe('event listeners', () => {
    it('should register event listeners on initialization', () => {
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function))
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function))
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function))
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function))
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should emit status change events', () => {
      const statusChangeHandler = vi.fn()
      updaterService.onStatusChange(statusChangeHandler)

      const updateAvailableCallback = mockAutoUpdater.on.mock.calls.find(
        (call: any[]) => call[0] === 'update-available'
      )?.[1]

      if (updateAvailableCallback) {
        updateAvailableCallback({
          version: '2.0.0',
          releaseNotes: 'New features',
          releaseDate: '2026-05-13'
        })

        expect(statusChangeHandler).toHaveBeenCalledWith({
          status: UpdateStatus.AVAILABLE,
          updateInfo: expect.objectContaining({
            version: '2.0.0'
          })
        })
      }
    })

    it('should emit download progress events', () => {
      const progressHandler = vi.fn()
      updaterService.onDownloadProgress(progressHandler)

      const downloadProgressCallback = mockAutoUpdater.on.mock.calls.find(
        (call: any[]) => call[0] === 'download-progress'
      )?.[1]

      if (downloadProgressCallback) {
        downloadProgressCallback({ percent: 50 })

        expect(progressHandler).toHaveBeenCalledWith(50)
      }
    })
  })
})
