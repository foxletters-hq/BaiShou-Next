import { useEffect, useState } from 'react'
import type { KnowledgeOcrProgressState, KnowledgeSourceRow } from './knowledge-detail.types'
import {
  knowledgeOrganizeHasLiveWork,
  notebookOrganizeShouldKeepWatching
} from './knowledge-organize-fab.util'
import {
  knowledgeOrganizeRememberedTotal,
  knowledgeOrganizeSourceCount,
  type KnowledgeOrganizeJobItem
} from './knowledge-organize-banner.util'

/**
 * 知识库整理任务的活动状态。
 * 同时消费提取进度与图任务，向详情页提供横幅计数、进度文案和整理完成总数。
 */
export function useKnowledgeDetailOrganize(input: {
  sources: KnowledgeSourceRow[]
  pendingJobs: number
  ocrProgressBySource: Record<string, KnowledgeOcrProgressState>
}) {
  const { sources, pendingJobs, ocrProgressBySource } = input
  const [graphJobItems, setGraphJobItems] = useState<KnowledgeOrganizeJobItem[]>([])
  const [organizeJobItems, setOrganizeJobItems] = useState<KnowledgeOrganizeJobItem[]>([])
  const [organizeWatching, setOrganizeWatching] = useState(false)
  const [organizeKnownTotal, setOrganizeKnownTotal] = useState(0)

  const organizeLiveInput = {
    ingestingCount: sources.filter((s) => s.status === 'extracting' || s.status === 'embedding')
      .length,
    sources,
    graphJobItems,
    ingestJobItems: organizeJobItems,
    ocrProgressBySource
  }
  const hasLiveIngest = knowledgeOrganizeHasLiveWork(organizeLiveInput)
  const keepWatching = notebookOrganizeShouldKeepWatching(organizeLiveInput)
  const currentOrganizeCount = knowledgeOrganizeSourceCount({
    ingestingCount: organizeLiveInput.ingestingCount,
    pendingJobs,
    graphJobItems,
    ingestJobItems: organizeJobItems,
    ocrProgressBySource
  })
  const runningGraph = graphJobItems.find((item) => item.status === 'running')
  const runningGraphProgress = runningGraph ? ocrProgressBySource[runningGraph.sourceId] : undefined
  const graphProgress = runningGraph
    ? [
        runningGraph.title,
        runningGraph.pageTotal && runningGraph.pageTo
          ? `${runningGraph.pageTo}/${runningGraph.pageTotal}`
          : runningGraph.windowsTotal
            ? `${runningGraph.windowsDone ?? 0}/${runningGraph.windowsTotal}`
            : runningGraphProgress?.total
              ? `${runningGraphProgress.page}/${runningGraphProgress.total}`
              : ''
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  useEffect(() => {
    setOrganizeKnownTotal((prev) =>
      knowledgeOrganizeRememberedTotal(
        prev,
        currentOrganizeCount,
        organizeWatching || hasLiveIngest
      )
    )
  }, [currentOrganizeCount, hasLiveIngest, organizeWatching])

  useEffect(() => {
    if (!organizeWatching) return
    if (keepWatching) return
    setOrganizeWatching(false)
  }, [hasLiveIngest, keepWatching, organizeJobItems, organizeWatching, sources])

  return {
    fields: {
      graphJobItems,
      organizeJobItems,
      organizeWatching,
      organizeKnownTotal,
      graphProgress,
      ingestingCount: organizeLiveInput.ingestingCount
    },
    setGraphJobItems,
    setOrganizeJobItems,
    setOrganizeWatching
  }
}
