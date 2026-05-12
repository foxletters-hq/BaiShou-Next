import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UpdateStatus } from '../updater.types'
import { UpdateTimeoutError, UpdateCheckError } from '../updater.errors'

// Mock electron-updater
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
    currentVersion: '1.0.0',
  },
}))

// Mock electron
vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    isPackaged: false,
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}))

describe('UpdaterService', () => {
  let updaterService: any
  let mockAutoUpdater: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { autoUpdater } = await import('electron-updater')
    mockAutoUpdater = autoUpdater

    // 动态导入服务
    const { UpdaterService } = await import('../updater.service')
    updaterService = new UpdaterService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCurrentVersion', () => {
    it('should return current version', () => {
      const version = updaterService.getCurrentVersion()
      expect(version).toBe('1.0.0')
    })
  })

  describe('checkForUpdates', () => {
    it('should return hasUpdate true when update is available', async () => {
      const mockUpdateInfo = {
        version: '2.0.0',
        releaseNotes: 'New features',
        releaseDate: '2026-05-13',
      }

      mockAutoUpdater.checkForUpdates.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: mockUpdateInfo,
      })

      const result = await updaterService.checkForUpdates()

      expect(result.hasUpdate).toBe(true)
      expect(result.currentVersion).toBe('1.0.0')
      expect(result.updateInfo).toEqual({
        version: '2.0.0',
        releaseNotes: 'New features',
        releaseDate: '2026-05-13',
        releaseUrl: expect.any(String),
      })
    })

    it('should return hasUpdate false when no update available', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue({
        isUpdateAvailable: false,
        updateInfo: null,
      })

      const result = await updaterService.checkForUpdates()

      expect(result.hasUpdate).toBe(false)
      expect(result.updateInfo).toBeNull()
    })

    it(
      'should throw UpdateTimeoutError when check times out',
      async () => {
        mockAutoUpdater.checkForUpdates.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 15000))
        )

        await expect(updaterService.checkForUpdates()).rejects.toThrow(UpdateTimeoutError)
      },
      15000
    )

    it('should throw UpdateCheckError when check fails', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('Network error'))

      await expect(updaterService.checkForUpdates()).rejects.toThrow(UpdateCheckError)
    })
  })

  describe('downloadUpdate', () => {
    it('should call autoUpdater.downloadUpdate', async () => {
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

      // 模拟 update-available 事件
      const updateAvailableCallback = mockAutoUpdater.on.mock.calls.find(
        (call: any[]) => call[0] === 'update-available'
      )?.[1]

      if (updateAvailableCallback) {
        updateAvailableCallback({
          version: '2.0.0',
          releaseNotes: 'New features',
          releaseDate: '2026-05-13',
        })

        expect(statusChangeHandler).toHaveBeenCalledWith({
          status: UpdateStatus.AVAILABLE,
          updateInfo: expect.objectContaining({
            version: '2.0.0',
          }),
        })
      }
    })

    it('should emit download progress events', () => {
      const progressHandler = vi.fn()
      updaterService.onDownloadProgress(progressHandler)

      // 模拟 download-progress 事件
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
