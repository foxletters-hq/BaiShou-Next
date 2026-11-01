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
  /** channel.json 检查到的新版安装包直链或发布页直链 */
  private pendingChannelDownloadUrl: string | null = null

  constructor() {
    this.initEventListeners()
  }

  /** 初始化事件监听（electron-updater 备用） */
  private initEventListeners(): void {
    autoUpdater.on('update-available', (info) => {
      const releaseUrl = this.buildReleaseUrl(info.version)
      this.pendingChannelDownloadUrl = releaseUrl
      this.notifyStatusChange(UpdateStatus.AVAILABLE, {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
        releaseDate: info.releaseDate,
        releaseUrl
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.notifyStatusChange(UpdateStatus.NOT_AVAILABLE)
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

  /** 注册状态变更回调 */
  onStatusChange(callback: StatusChangeCallback): void {
    this.statusChangeCallbacks.push(callback)
  }

  /** 注册下载进度回调（已废弃：已改为转直链下载，无需进度监听） */
  onDownloadProgress(_callback: ProgressCallback): void {}

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
      this.pendingChannelDownloadUrl = downloadUrl || releaseUrl
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
        const releaseUrl = this.buildReleaseUrl(result.updateInfo.version)
        this.pendingChannelDownloadUrl = releaseUrl
        updateInfo = {
          version: result.updateInfo.version,
          releaseNotes:
            typeof result.updateInfo.releaseNotes === 'string'
              ? result.updateInfo.releaseNotes
              : '',
          releaseDate: result.updateInfo.releaseDate,
          releaseUrl
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

  /** 下载更新：用系统默认浏览器直接转到直链 */
  async downloadUpdate(): Promise<void> {
    const targetUrl =
      this.pendingChannelDownloadUrl || this.buildReleaseUrl(this.getCurrentVersion())

    try {
      await shell.openExternal(targetUrl)
    } catch (error) {
      throw new UpdateCheckError(
        error instanceof Error
          ? error.message
          : i18n.t('auto.apps.desktop.src.main.services.updater.service.L251', '打开下载链接失败')
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
