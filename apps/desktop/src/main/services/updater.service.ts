import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { UpdateStatus, type UpdateCheckResult, type UpdateInfo } from './updater.types'
import { UpdateTimeoutError, UpdateCheckError } from './updater.errors'

/** 超时时间（毫秒） */
const CHECK_TIMEOUT_MS = 10000

/** 更新事件回调类型 */
type StatusChangeCallback = (state: { status: UpdateStatus; updateInfo?: UpdateInfo | null }) => void
type ProgressCallback = (progress: number) => void

export class UpdaterService {
  private autoCheck = true
  private statusChangeCallbacks: StatusChangeCallback[] = []
  private progressCallbacks: ProgressCallback[] = []

  constructor() {
    this.initEventListeners()
  }

  /** 初始化事件监听 */
  private initEventListeners(): void {
    autoUpdater.on('update-available', (info) => {
      this.notifyStatusChange(UpdateStatus.AVAILABLE, {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
        releaseDate: info.releaseDate,
        releaseUrl: this.buildReleaseUrl(info.version),
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
        releaseUrl: this.buildReleaseUrl(info.version),
      })
    })

    autoUpdater.on('error', (error) => {
      this.notifyStatusChange(UpdateStatus.ERROR)
      console.error('[UpdaterService] 更新错误:', error)
    })
  }

  /** 构建 Release URL */
  private buildReleaseUrl(version: string): string {
    return `https://github.com/Anson-Trio/BaiShou-Next/releases/tag/v${version}`
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

  /** 获取当前版本 */
  getCurrentVersion(): string {
    return app.getVersion()
  }

  /** 检查更新 */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    this.notifyStatusChange(UpdateStatus.CHECKING)

    try {
      const result = await Promise.race([
        autoUpdater.checkForUpdates(),
        this.createTimeoutPromise(),
      ])

      if (!result) {
        return {
          hasUpdate: false,
          currentVersion: this.getCurrentVersion(),
          updateInfo: null,
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
          releaseUrl: this.buildReleaseUrl(result.updateInfo.version),
        }
      }

      return {
        hasUpdate,
        currentVersion: this.getCurrentVersion(),
        updateInfo,
      }
    } catch (error) {
      if (error instanceof UpdateTimeoutError) {
        throw error
      }
      throw new UpdateCheckError(error instanceof Error ? error.message : '检查更新失败')
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

  /** 下载更新 */
  async downloadUpdate(): Promise<void> {
    this.notifyStatusChange(UpdateStatus.DOWNLOADING)

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      throw new UpdateCheckError(error instanceof Error ? error.message : '下载更新失败')
    }
  }

  /** 安装更新并退出 */
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
