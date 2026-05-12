/** 更新状态枚举 */
export enum UpdateStatus {
  IDLE = 'idle',
  CHECKING = 'checking',
  AVAILABLE = 'available',
  DOWNLOADING = 'downloading',
  DOWNLOADED = 'downloaded',
  NOT_AVAILABLE = 'not_available',
  ERROR = 'error',
}

/** 更新信息 */
export interface UpdateInfo {
  version: string
  releaseNotes: string
  releaseDate: string
  releaseUrl: string
}

/** 更新状态 */
export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  updateInfo: UpdateInfo | null
  downloadProgress: number
  error: string | null
}

/** 更新检查结果 */
export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  updateInfo: UpdateInfo | null
}
