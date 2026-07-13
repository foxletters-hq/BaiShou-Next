import type { SyncProgressEvent } from '@baishou/shared'

export type MobileIncrementalProgress = Partial<
  Pick<
    SyncProgressEvent,
    'phase' | 'fileName' | 'action' | 'statusText' | 'fileBytesDone' | 'fileBytesTotal'
  >
> & {
  current: number
  total: number
}

export type MobileIncrementalSyncOutcome = {
  uploaded: number
  downloaded: number
  conflicts: number
  skipped: number
  deletedRemote: number
  deletedLocal: number
  failed: number
  failedPaths: string[]
  uploadedPaths: string[]
  downloadedPaths: string[]
  deletedLocalPaths: string[]
  deletedRemotePaths: string[]
}

export type MobileIncrementalExecutionContext = {
  signal?: AbortSignal
}
