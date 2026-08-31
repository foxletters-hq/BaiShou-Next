export type NotebookGraphJobSnapshot = {
  pending: number
  running: number
  failed: number
  currentSourceTitle: string | null
  knownTotal?: number
  windowsDone?: number
  windowsTotal?: number
}

export type NotebookGraphProgressCopy = {
  visible: boolean
  percent: number
  headlineKey: string
  headlineParams?: Record<string, string | number>
  detailKey: string
  detailParams?: Record<string, string | number>
}

export type NotebookGraphProgressView = NotebookGraphProgressCopy & {
  headline: string
  detail: string
}

type TranslateFn = (key: string, options?: Record<string, string | number>) => string

export function notebookGraphProgressCopy(
  snapshot: NotebookGraphJobSnapshot
): NotebookGraphProgressCopy {
  const remaining = Math.max(0, snapshot.pending, snapshot.running)
  const failed = Math.max(0, snapshot.failed)
  const total = Math.max(snapshot.knownTotal ?? 0, remaining)
  const done = Math.max(0, total - remaining)
  const windowTotal = Math.max(0, snapshot.windowsTotal ?? 0)
  const windowDone = Math.max(0, Math.min(windowTotal, snapshot.windowsDone ?? 0))
  const percent =
    windowTotal > 0
      ? Math.min(100, Math.round((windowDone / windowTotal) * 100))
      : total === 0
        ? 0
        : Math.min(100, Math.round((done / total) * 100))
  const visible = remaining > 0 || failed > 0
  if (!visible) {
    return {
      visible: false,
      percent: 100,
      headlineKey: '',
      detailKey: ''
    }
  }
  if (remaining > 0) {
    const current = snapshot.currentSourceTitle?.trim()
    return {
      visible: true,
      percent,
      headlineKey: current
        ? 'knowledge.graph_progress_current'
        : 'knowledge.graph_progress_generic',
      headlineParams: current ? { title: current } : undefined,
      detailKey:
        windowTotal > 0
          ? 'knowledge.graph_progress_window'
          : total > 0
            ? 'knowledge.graph_progress_done_of'
            : 'knowledge.graph_progress_queued',
      detailParams:
        windowTotal > 0
          ? { done: windowDone, total: windowTotal }
          : total > 0
            ? { done, total }
            : { remaining }
    }
  }
  return {
    visible: true,
    percent: 100,
    headlineKey: 'knowledge.graph_progress_failed_headline',
    detailKey: 'knowledge.graph_progress_failed_detail',
    detailParams: { failed }
  }
}

export function formatNotebookGraphProgress(
  copy: NotebookGraphProgressCopy,
  t: TranslateFn
): NotebookGraphProgressView {
  return {
    ...copy,
    headline: copy.headlineKey ? t(copy.headlineKey, copy.headlineParams) : '',
    detail: copy.detailKey ? t(copy.detailKey, copy.detailParams) : ''
  }
}

export function notebookGraphProgressView(
  snapshot: NotebookGraphJobSnapshot,
  t?: TranslateFn
): NotebookGraphProgressView {
  const copy = notebookGraphProgressCopy(snapshot)
  if (!t) {
    return {
      ...copy,
      headline: copy.headlineKey,
      detail: copy.detailKey
    }
  }
  return formatNotebookGraphProgress(copy, t)
}
