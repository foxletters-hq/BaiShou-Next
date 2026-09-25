export type GraphWindowCounts = {
  windowsDone: number
  windowsTotal: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export type GraphWindowProgress = GraphWindowCounts & {
  notebookId: string
  sourceId: string
}

const liveProgress = new Map<string, GraphWindowCounts>()

function progressKey(notebookId: string, sourceId: string): string {
  return `${notebookId}\n${sourceId}`
}

/** 界面上报的当前窗口。检查点只在解析成功后落盘，切页不能只靠检查点。 */
export function rememberGraphWindowProgress(progress: GraphWindowProgress): void {
  const notebookId = progress.notebookId.trim()
  const sourceId = progress.sourceId.trim()
  if (!notebookId || !sourceId || progress.windowsTotal <= 0) return
  const remembered: GraphWindowCounts = {
    windowsDone: Math.max(0, progress.windowsDone),
    windowsTotal: progress.windowsTotal
  }
  if (
    (progress.pageTotal ?? 0) > 0 &&
    (progress.pageTo ?? 0) > 0 &&
    (progress.pageFrom ?? 0) > 0
  ) {
    remembered.pageFrom = progress.pageFrom
    remembered.pageTo = progress.pageTo
    remembered.pageTotal = progress.pageTotal
  }
  liveProgress.set(progressKey(notebookId, sourceId), remembered)
}

export function readGraphWindowProgress(
  notebookId: string,
  sourceId: string
): GraphWindowCounts | null {
  return liveProgress.get(progressKey(notebookId.trim(), sourceId.trim())) ?? null
}

export function clearGraphWindowProgress(notebookId: string, sourceId: string): void {
  liveProgress.delete(progressKey(notebookId.trim(), sourceId.trim()))
}

/** 只有本进程正在做的任务才算 running；库里残留的 running 当 pending，避免界面假忙。 */
export function resolveListedGraphJobStatus(
  dbStatus: string,
  live: boolean
): 'pending' | 'running' | 'failed' {
  if (live) return 'running'
  if (dbStatus === 'failed') return 'failed'
  return 'pending'
}

/** 打开笔记本列出任务时，把已入队但没人做的图谱任务重新拉起来。 */
export function shouldResumeListedGraphJobs(items: ReadonlyArray<{ status: string }>): boolean {
  return items.some((item) => item.status === 'pending' || item.status === 'failed')
}

/**
 * 任务还在跑时，取检查点和当前窗口里更大的那个。
 * 任务已经结束就只信检查点，避免上次的窗口序号把界面停在「进行中」。
 */
export function resolveListedGraphWindowProgress(input: {
  running: boolean
  checkpoint: GraphWindowCounts | null
  live: GraphWindowCounts | null
}): GraphWindowCounts | null {
  const checkpoint = input.checkpoint && input.checkpoint.windowsTotal > 0 ? input.checkpoint : null
  const live = input.running && input.live && input.live.windowsTotal > 0 ? input.live : null
  const windowsTotal = Math.max(checkpoint?.windowsTotal ?? 0, live?.windowsTotal ?? 0)
  if (windowsTotal <= 0) return null
  const windowsDone = Math.min(
    windowsTotal,
    Math.max(0, checkpoint?.windowsDone ?? 0, live?.windowsDone ?? 0)
  )
  const pageSource =
    live && live.windowsDone === windowsDone
      ? live
      : checkpoint && checkpoint.windowsDone === windowsDone
        ? checkpoint
        : null
  const resolved: GraphWindowCounts = { windowsDone, windowsTotal }
  if (
    pageSource &&
    (pageSource.pageTotal ?? 0) > 0 &&
    (pageSource.pageTo ?? 0) > 0 &&
    (pageSource.pageFrom ?? 0) > 0
  ) {
    resolved.pageFrom = pageSource.pageFrom
    resolved.pageTo = pageSource.pageTo
    resolved.pageTotal = pageSource.pageTotal
  }
  return resolved
}
