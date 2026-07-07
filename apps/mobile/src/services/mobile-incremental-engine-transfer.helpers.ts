import i18n from 'i18next'
import { normalizeSyncFilePath } from './android-external-fs'
import type { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import type { MobileIncrementalProgress } from './mobile-incremental-engine.types'

export const SYNC_ACTIVITY_STATUS: Record<string, string> = {
  preparing: i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L81', '正在连接…'),
  reading: i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L82', '正在读取文件…'),
  uploading: i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L83', '正在上传…'),
  downloading: i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L84', '正在下载…'),
  writing: i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L85', '正在写入磁盘…'),
  checkpointing: i18n.t(
    'auto.apps.mobile.src.services.mobile.incremental.engine.L86',
    '正在保存同步进度…'
  )
}

type IncrementalProgressCallback = (progress: MobileIncrementalProgress) => void

type InFlightTransferMap = Map<
  string,
  { relPath: string; action: MobileIncrementalProgress['action'] }
>

function syncActivityStatusText(activity: string): string | undefined {
  return SYNC_ACTIVITY_STATUS[activity]
}

export function resolveInFlightTransfer(
  inFlight: InFlightTransferMap,
  filePath: string
): { relPath: string; action: MobileIncrementalProgress['action'] } | undefined {
  const normalized = normalizeSyncFilePath(filePath)
  const direct = inFlight.get(filePath) ?? inFlight.get(normalized)
  if (direct) return direct
  for (const [key, info] of inFlight) {
    if (normalizeSyncFilePath(key) === normalized) return info
  }
  return undefined
}

export function emitFileTransferStart(
  onProgress: IncrementalProgressCallback | undefined,
  completed: number,
  total: number,
  filePath: string,
  action: MobileIncrementalProgress['action'],
  fileBytesTotal?: number
): void {
  if (action !== 'upload' && action !== 'download') return
  onProgress?.({
    phase: 'syncing',
    current: completed,
    total,
    fileName: filePath,
    action,
    fileBytesDone: 0,
    fileBytesTotal: fileBytesTotal && fileBytesTotal > 0 ? fileBytesTotal : undefined,
    statusText:
      action === 'upload'
        ? i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L83', '正在上传…')
        : i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L84', '正在下载…')
  })
}

export function bindTransferProgress(
  client: MobileIncrementalCloudClient,
  onProgress: IncrementalProgressCallback | undefined,
  getCompleted: () => number,
  total: number,
  inFlight: InFlightTransferMap
): (relPath: string) => { done: number; total: number } | undefined {
  const lastByteProgress = new Map<string, { done: number; total: number }>()

  const publish = (payload: MobileIncrementalProgress) => {
    onProgress?.(payload)
  }

  client.setTransferProgressCallback((bytesDone, bytesTotal, filePath) => {
    const info = resolveInFlightTransfer(inFlight, filePath)
    if (!info || bytesTotal <= 0) return
    lastByteProgress.set(info.relPath, { done: bytesDone, total: bytesTotal })
    publish({
      phase: 'syncing',
      current: getCompleted(),
      total,
      fileName: info.relPath,
      action: info.action,
      fileBytesDone: bytesDone,
      fileBytesTotal: bytesTotal,
      statusText:
        info.action === 'upload'
          ? i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L83', '正在上传…')
          : info.action === 'download'
            ? i18n.t('auto.apps.mobile.src.services.mobile.incremental.engine.L84', '正在下载…')
            : undefined
    })
  })
  client.setTransferActivityCallback((activity, filePath) => {
    const info = resolveInFlightTransfer(inFlight, filePath)
    if (!info) return
    const statusText = syncActivityStatusText(activity)
    if (!statusText) return
    const bytes = lastByteProgress.get(info.relPath)
    publish({
      phase: 'syncing',
      current: getCompleted(),
      total,
      fileName: info.relPath,
      action: info.action,
      fileBytesDone: bytes?.done,
      fileBytesTotal: bytes?.total,
      statusText
    })
  })

  return (relPath) => lastByteProgress.get(relPath)
}

export function trackInFlightTransfer(
  inFlight: InFlightTransferMap,
  fullPath: string,
  relPath: string,
  action: MobileIncrementalProgress['action']
): void {
  const entry = { relPath, action }
  inFlight.set(fullPath, entry)
  inFlight.set(normalizeSyncFilePath(fullPath), entry)
}
