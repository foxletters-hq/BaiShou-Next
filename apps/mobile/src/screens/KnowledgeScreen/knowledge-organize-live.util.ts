import type { Dispatch, SetStateAction } from 'react'
import type {
  MobileKnowledgeExtractProgress,
  MobileKnowledgeIngestLive
} from '@/src/services/mobile-knowledge-extract-config'
import type { KnowledgeOcrProgressState } from './knowledge-detail.types'
import type { KnowledgeOrganizeJobItem } from './knowledge-organize.types'

type ExtractProgressSetters = {
  setOcrProgressBySource: Dispatch<SetStateAction<Record<string, KnowledgeOcrProgressState>>>
  setGraphJobItems: Dispatch<SetStateAction<KnowledgeOrganizeJobItem[]>>
  setOrganizeJobItems: Dispatch<SetStateAction<KnowledgeOrganizeJobItem[]>>
}

function patchGraphProgress(
  prev: KnowledgeOrganizeJobItem[],
  info: MobileKnowledgeExtractProgress
): KnowledgeOrganizeJobItem[] {
  const idx = prev.findIndex((item) => item.sourceId === info.sourceId)
  const nextItem: KnowledgeOrganizeJobItem = {
    sourceId: info.sourceId,
    title: prev[idx]?.title || info.sourceId,
    stage: 'graph',
    status: 'running',
    lastError: prev[idx]?.lastError,
    windowsDone: info.windowsDone,
    windowsTotal: info.windowsTotal,
    nodesDone: info.nodesDone,
    nodesTotal: info.nodesTotal,
    pageFrom: info.pageFrom,
    pageTo: info.pageTo,
    pageTotal: info.pageTotal
  }
  if (idx < 0) return [...prev, nextItem]
  const next = [...prev]
  next[idx] = { ...next[idx], ...nextItem }
  return next
}

/** 把一次提取进度写入 OCR 进度表，并在抽图阶段同步更新任务列表。 */
export function applyKnowledgeExtractProgress(
  info: MobileKnowledgeExtractProgress,
  setters: ExtractProgressSetters
): void {
  setters.setOcrProgressBySource((prev) => {
    if (info.total <= 0 && !(info.windowsTotal && info.windowsTotal > 0)) {
      const next = { ...prev }
      delete next[info.sourceId]
      return next
    }
    return {
      ...prev,
      [info.sourceId]: {
        page: info.page,
        total: info.total,
        phase: info.phase,
        windowsDone: info.windowsDone,
        windowsTotal: info.windowsTotal,
        nodesDone: info.nodesDone,
        nodesTotal: info.nodesTotal,
        pageFrom: info.pageFrom,
        pageTo: info.pageTo,
        pageTotal: info.pageTotal
      }
    }
  })
  if (info.phase !== 'graph' && info.phase !== 'graphNodes') return
  setters.setGraphJobItems((prev) => patchGraphProgress(prev, info))
  setters.setOrganizeJobItems((prev) => patchGraphProgress(prev, info))
}

/** 收到 live 事件时把对应阶段标成运行中；列表里没有就补一条。 */
export function patchRunningOrganizeJob(
  prev: KnowledgeOrganizeJobItem[],
  info: MobileKnowledgeIngestLive
): KnowledgeOrganizeJobItem[] {
  const idx = prev.findIndex(
    (item) => item.sourceId === info.sourceId && (item.stage || '') === info.stage
  )
  if (idx >= 0) {
    const next = [...prev]
    next[idx] = { ...next[idx], status: 'running' }
    return next
  }
  return [
    ...prev,
    {
      sourceId: info.sourceId,
      title: info.sourceId,
      stage: info.stage,
      status: 'running'
    }
  ]
}
