import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/** 更新状态枚举 */
export enum UpdateStatus {
  IDLE = 'idle',
  CHECKING = 'checking',
  AVAILABLE = 'available',
  DOWNLOADING = 'downloading',
  DOWNLOADED = 'downloaded',
  NOT_AVAILABLE = 'not_available',
  ERROR = 'error'
}

/** 更新信息 */
export interface UpdateInfo {
  version: string
  releaseNotes: string
  releaseDate: string
  releaseUrl: string
}

/** 更新状态接口 */
export interface UpdaterState {
  status: UpdateStatus
  currentVersion: string
  updateInfo: UpdateInfo | null
  downloadProgress: number
  error: string | null
  autoCheck: boolean
}

/** 更新操作接口 */
export type CheckForUpdatesResult =
  | { skipped: false }
  | { skipped: true; reason?: 'development' | 'unconfigured' }

export interface UpdaterActions {
  checkForUpdates: () => Promise<CheckForUpdatesResult>
  downloadUpdate: () => Promise<void>
  quitAndInstall: () => void
  setAutoCheck: (enabled: boolean) => void
  loadAutoCheck: () => Promise<void>
  initIpcListeners: () => void
}

export const useUpdaterStore = create<UpdaterState & UpdaterActions>()(
  devtools(
    (set, get) => ({
      status: UpdateStatus.IDLE,
      currentVersion: '',
      updateInfo: null,
      downloadProgress: 0,
      error: null,
      autoCheck: true,

      checkForUpdates: async () => {
        if (typeof window === 'undefined' || !(window as any).api?.updater) {
          return { skipped: true, reason: 'unconfigured' as const }
        }

        set({ status: UpdateStatus.CHECKING, error: null })

        try {
          const result = await (window as any).api.updater.check()
          if (result.skipped) {
            set({
              status: UpdateStatus.IDLE,
              currentVersion: result.currentVersion,
              updateInfo: null,
              error: null
            })
            return { skipped: true, reason: result.skipReason }
          }
          set({
            status: result.hasUpdate ? UpdateStatus.AVAILABLE : UpdateStatus.NOT_AVAILABLE,
            currentVersion: result.currentVersion,
            updateInfo: result.updateInfo,
            error: null
          })
          return { skipped: false }
        } catch (error: any) {
          set({
            status: UpdateStatus.ERROR,
            error: error.message || 'Update check failed'
          })
          return { skipped: false }
        }
      },

      downloadUpdate: async () => {
        if (typeof window === 'undefined' || !(window as any).api?.updater) {
          return
        }

        set({ status: UpdateStatus.DOWNLOADING, downloadProgress: 0 })

        try {
          await (window as any).api.updater.download()
        } catch (error: any) {
          set({
            status: UpdateStatus.ERROR,
            error: error.message || '下载更新失败'
          })
        }
      },

      quitAndInstall: () => {
        if (typeof window === 'undefined' || !(window as any).api?.updater) {
          return
        }
        ;(window as any).api.updater.install()
      },

      setAutoCheck: async (enabled: boolean) => {
        set({ autoCheck: enabled })
        if (typeof window !== 'undefined' && (window as any).api?.updater) {
          await (window as any).api.updater.setAutoCheck(enabled)
        }
      },

      loadAutoCheck: async () => {
        if (typeof window === 'undefined' || !(window as any).api?.updater) {
          return
        }
        try {
          const autoCheck = await (window as any).api.updater.getAutoCheck()
          set({ autoCheck })
        } catch (e) {
          console.error('[UpdaterStore] Failed to load auto check setting', e)
        }
      },

      initIpcListeners: () => {
        if (typeof window === 'undefined' || !(window as any).api?.updater) {
          return
        }

        const { updater } = (window as any).api

        updater.onStatusChange((state: any) => {
          set({
            status: state.status,
            updateInfo: state.updateInfo || get().updateInfo,
            error: state.status === UpdateStatus.ERROR ? state.error : null
          })
        })

        updater.onDownloadProgress((progress: number) => {
          set({ downloadProgress: progress })
        })
      }
    }),
    { name: 'UpdaterStore' }
  )
)
