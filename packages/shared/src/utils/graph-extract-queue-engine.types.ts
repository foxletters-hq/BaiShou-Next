import {
  GRAPH_EXTRACT_ALIGN_POOL_SIZE,
  type GraphExtractQueuePhase
} from './graph-extract-batch.util'

export type GraphExtractQueueStatus = 'pending' | 'running' | 'aligning' | 'completed' | 'error'

export interface GraphExtractQueueItem {
  id: string
  filePath: string
  date?: string
  /** 自动接续时记下正文哈希，取消后只拦截同一版正文 */
  contentHash?: string
  progress: number
  status: GraphExtractQueueStatus
  phase?: GraphExtractQueuePhase
  phaseDetail?: string
  error?: string
}

export type GraphExtractQueueSnapshot = {
  items: GraphExtractQueueItem[]
  activeCount: number
  pendingCount: number
  runningCount: number
  aligningCount: number
  completedCount: number
  errorCount: number
  overallProgress: number
  alignPoolSize: number
  alignPoolCount: number
}

export function emptyGraphExtractQueueSnapshot(
  alignPoolSize = GRAPH_EXTRACT_ALIGN_POOL_SIZE
): GraphExtractQueueSnapshot {
  return {
    items: [],
    activeCount: 0,
    pendingCount: 0,
    runningCount: 0,
    aligningCount: 0,
    completedCount: 0,
    errorCount: 0,
    overallProgress: 0,
    alignPoolSize,
    alignPoolCount: 0
  }
}

export type GraphExtractQueueRunnerResult = {
  done: number
  failed: number
  cancelled?: boolean
  errors: Array<{ filePath: string; message: string }>
  draft?: unknown
}

export type GraphExtractQueueProgressUpdate = {
  progress?: number
  phase?: GraphExtractQueuePhase
  detail?: string
}

export type GraphExtractQueueRunner = (opts: {
  filePath: string
  signal: AbortSignal
  onProgress?: (update: GraphExtractQueueProgressUpdate) => void
}) => Promise<GraphExtractQueueRunnerResult>

export type GraphExtractQueuedDraft = { filePath: string; draft: unknown }

export type GraphExtractQueueFlushDrafts = (
  drafts: GraphExtractQueuedDraft[],
  signal?: AbortSignal,
  onPhase?: (phase: GraphExtractQueuePhase, detail?: string) => void
) => Promise<Array<{ filePath: string; error?: string }>>

export type GraphExtractQueueMessages = {
  cancelled: string
  failed: string
  skipped: string
}

export type GraphExtractQueueEngineOptions = {
  persist?: (pending: Array<{ filePath: string; date?: string }>) => void
  broadcast?: (state: GraphExtractQueueSnapshot) => void
  messages?: () => GraphExtractQueueMessages
  concurrency?: number
  alignPoolSize?: number
  flushDrafts?: GraphExtractQueueFlushDrafts
  cleanupMs?: number
  watchdogMs?: number
  /** 流式进度广播间隔；0 = 立即广播（测试）。 */
  progressThrottleMs?: number
  /** false = schedule the next job in the same turn (tests). */
  deferKick?: boolean
}

export const DEFAULT_GRAPH_EXTRACT_QUEUE_MESSAGES: GraphExtractQueueMessages = {
  cancelled: '用户取消了抽取',
  failed: '整理失败',
  skipped: '已跳过（不在待重抽列表）'
}
