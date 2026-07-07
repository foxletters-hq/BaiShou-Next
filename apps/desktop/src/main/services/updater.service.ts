import i18n from 'i18next'
import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import {
  fetchReleaseChannelManifest,
  isAppVersionNewer,
  releaseTagToPageUrl
} from '@baishou/shared'
import { APP_VERSION, APP_VERSION_NUMBER } from '../../app-version'
import { UpdateStatus, type UpdateCheckResult, type UpdateInfo } from './updater.types'
import { UpdateTimeoutError, UpdateCheckError } from './updater.errors'

/** 超时时间（毫秒） */
const CHECK_TIMEOUT_MS = 10000

/** 更新事件回调类型 */
type StatusChangeCallback = (state: {
  status: UpdateStatus
  updateInfo?: UpdateInfo | null
}) => void
type ProgressCallback = (progress: number) => void

export class UpdaterService {
  private autoCheck = true
  private statusChangeCallbacks: StatusChangeCallback[] = []
  private progressCallbacks: ProgressCallback[] = []
  /** channel.json 检查到的新版安装包直链 */
  private pendingChannelDownloadUrl: string | null = null

  constructor() {
    this.initEventListeners()
  }

  /** 初始化事件监听（electron-updater 备用） */
  private initEventListeners(): void {
    autoUpdater.on('update-available', (info) => {
      this.notifyStatusChange(UpdateStatus.AVAILABLE, {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
        releaseDate: info.releaseDate,
        releaseUrl: this.buildReleaseUrl(info.version)
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.notifyStatusChange(UpdateStatus.NOT_AVAILABLE)
    })

    autoUpdater.on('download-progress', (progress) => {
      this.notifyProgress(progress.percent)
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.notifyStatusChange(UpdateStatus.DOWNLOADED, {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
        releaseDate: info.releaseDate,
        releaseUrl: this.buildReleaseUrl(info.version)
      })
    })

    autoUpdater.on('error', (error) => {
      this.notifyStatusChange(UpdateStatus.ERROR)
      console.error('[UpdaterService] 更新错误:', error)
    })
  }

  /** 构建 Release URL（electron-updater 备用） */
  private buildReleaseUrl(version: string): string {
    return `https://github.com/foxletters-hq/BaiShou-Next/releases/tag/v${version}`
  }

  /** 通知状态变更 */
  private notifyStatusChange(status: UpdateStatus, updateInfo?: UpdateInfo | null): void {
    for (const callback of this.statusChangeCallbacks) {
      callback({ status, updateInfo })
    }
  }

  /** 通知下载进度 */
  private notifyProgress(progress: number): void {
    for (const callback of this.progressCallbacks) {
      callback(progress)
    }
  }

  /** 注册状态变更回调 */
  onStatusChange(callback: StatusChangeCallback): void {
    this.statusChangeCallbacks.push(callback)
  }

  /** 注册下载进度回调 */
  onDownloadProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback)
  }

  /** 获取当前版本（营销版本，供 UI 展示） */
  getCurrentVersion(): string {
    return APP_VERSION
  }

  /** 优先读 releases/channel.json，失败时回退 electron-updater */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = this.getCurrentVersion()

    if (!app.isPackaged) {
      this.notifyStatusChange(UpdateStatus.IDLE)
      return {
        hasUpdate: false,
        currentVersion,
        updateInfo: null,
        skipped: true,
        skipReason: 'development'
      }
    }

    this.notifyStatusChange(UpdateStatus.CHECKING)
    this.pendingChannelDownloadUrl = null

    try {
      const channelResult = await Promise.race([
        this.checkViaReleaseChannel(),
        this.createTimeoutPromise()
      ])
      if (channelResult) {
        return channelResult
      }
    } catch (error) {
      if (error instanceof UpdateTimeoutError) {
        throw error
      }
      console.warn('[UpdaterService] channel.json 检查失败，尝试 electron-updater:', error)
    }

    return this.checkViaElectronUpdater()
  }

  private async checkViaReleaseChannel(): Promise<UpdateCheckResult | null> {
    const manifest = await fetchReleaseChannelManifest()
    const windows = manifest.windows
    if (!windows?.version) {
      return null
    }

    const latestVersion = windows.version
    const hasUpdate = isAppVersionNewer(latestVersion, APP_VERSION_NUMBER)
    const downloadUrl = windows.downloadUrl
    const releaseUrl = windows.tag ? releaseTagToPageUrl(windows.tag) : downloadUrl

    let updateInfo: UpdateInfo | null = null
    if (hasUpdate) {
      this.pendingChannelDownloadUrl = downloadUrl
      updateInfo = {
        version: latestVersion,
        releaseNotes: '',
        releaseDate: manifest.updatedAt ?? '',
        releaseUrl: downloadUrl || releaseUrl
      }
      this.notifyStatusChange(UpdateStatus.AVAILABLE, updateInfo)
    } else {
      this.notifyStatusChange(UpdateStatus.NOT_AVAILABLE)
    }

    return {
      hasUpdate,
      currentVersion: this.getCurrentVersion(),
      updateInfo
    }
  }

  private async checkViaElectronUpdater(): Promise<UpdateCheckResult> {
    const currentVersion = this.getCurrentVersion()

    try {
      const result = await Promise.race([
        autoUpdater.checkForUpdates(),
        this.createTimeoutPromise()
      ])

      if (!result) {
        return {
          hasUpdate: false,
          currentVersion: this.getCurrentVersion(),
          updateInfo: null
        }
      }

      const hasUpdate = result.isUpdateAvailable
      let updateInfo: UpdateInfo | null = null

      if (hasUpdate && result.updateInfo) {
        updateInfo = {
          version: result.updateInfo.version,
          releaseNotes:
            typeof result.updateInfo.releaseNotes === 'string'
              ? result.updateInfo.releaseNotes
              : '',
          releaseDate: result.updateInfo.releaseDate,
          releaseUrl: this.buildReleaseUrl(result.updateInfo.version)
        }
      }

      return {
        hasUpdate,
        currentVersion: this.getCurrentVersion(),
        updateInfo
      }
    } catch (error) {
      this.notifyStatusChange(UpdateStatus.ERROR)
      const message = error instanceof Error ? error.message : String(error)
      const looksUnconfigured =
        /app-update\.yml|dev-app-update|ENOENT|404|not configured|no published|channel/i.test(
          message
        )
      if (looksUnconfigured) {
        return {
          hasUpdate: false,
          currentVersion,
          updateInfo: null,
          skipped: true,
          skipReason: 'unconfigured'
        }
      }
      if (error instanceof UpdateTimeoutError) {
        throw error
      }
      throw new UpdateCheckError(message || 'Update check failed')
    }
  }

  /** 创建超时 Promise */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new UpdateTimeoutError())
      }, CHECK_TIMEOUT_MS)
    })
  }

  /** 下载更新：channel 直链用浏览器打开，否则走 electron-updater */
  async downloadUpdate(): Promise<void> {
    if (this.pendingChannelDownloadUrl) {
      await shell.openExternal(this.pendingChannelDownloadUrl)
      return
    }

    this.notifyStatusChange(UpdateStatus.DOWNLOADING)

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      throw new UpdateCheckError(
        error instanceof Error
          ? error.message
          : i18n.t('auto.apps.desktop.src.main.services.updater.service.L251', '下载更新失败')
      )
    }
  }

  /** 安装更新并退出（仅 electron-updater 下载完成后可用） */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall(true, true)
  }

  /** 设置自动检查 */
  setAutoCheck(enabled: boolean): void {
    this.autoCheck = enabled
  }

  /** 获取自动检查状态 */
  getAutoCheck(): boolean {
    return this.autoCheck
  }
}
