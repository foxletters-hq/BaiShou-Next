import {
  mobileGetKnowledgeStats,
  mobileGetNotebookGraphView,
  mobileHasKnowledgeModelMismatch,
  resolveMobileActiveVaultId
} from '@/src/services/mobile-knowledge.service'
import { mobileListNotebookSimilarPendingPairs } from '@/src/services/mobile-notebook-graph-review'
import type { KnowledgeNotebookStats } from './knowledge-screen.util'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

type SimilarPairs = Awaited<ReturnType<typeof mobileListNotebookSimilarPendingPairs>>

type OverviewInput = {
  notebookId: string
  viewMaxNodes: number
  setStats: (stats: KnowledgeNotebookStats) => void
  setModelMismatch: (mismatch: boolean) => void
  setGraphNodes: (nodes: KnowledgeGraphNodeRow[]) => void
  setGraphEdges: (edges: KnowledgeGraphEdgeRow[]) => void
  setVaultId: (vaultId: string) => void
  setSimilarPairs: (pairs: SimilarPairs) => void
}

/**
 * 并行加载详情页概览：统计、模型一致性、图谱视图与相似待合并对。
 * 单个任务失败时保持各自原有的兜底值，不影响资料列表先展示。
 */
export async function loadKnowledgeDetailOverview(input: OverviewInput): Promise<void> {
  const statsTask = mobileGetKnowledgeStats(input.notebookId)
    .then((next) => {
      input.setStats({
        sources: next.sources,
        chunks: next.chunks,
        pendingJobs: next.pendingJobs,
        originalBytes: next.originalBytes ?? 0,
        totalBytes: next.totalBytes ?? 0
      })
    })
    .catch(() => undefined)

  const mismatchTask = mobileHasKnowledgeModelMismatch([input.notebookId])
    .then((mismatch) => input.setModelMismatch(mismatch))
    .catch(() => input.setModelMismatch(false))

  const graphTask = mobileGetNotebookGraphView(input.notebookId, input.viewMaxNodes)
    .then((view) => {
      input.setGraphNodes(
        (view.nodes || []).map((n) => ({
          id: n.id,
          name: n.name,
          nodeType: n.nodeType,
          reviewStatus: n.reviewStatus,
          summary: n.summary,
          propsJson: n.propsJson,
          mentionCount: n.mentionCount
        }))
      )
      input.setGraphEdges(
        (view.edges || []).map((e) => ({
          id: e.id,
          fromId: e.fromId,
          toId: e.toId,
          edgeType: e.edgeType,
          reviewStatus: e.reviewStatus,
          sourceExcerpt: e.sourceExcerpt,
          sourceRef: e.sourceRef
        }))
      )
    })
    .catch(() => {
      input.setGraphNodes([])
      input.setGraphEdges([])
    })

  const similarTask = resolveMobileActiveVaultId()
    .then(async (activeVaultId) => {
      input.setVaultId(activeVaultId)
      const pairs = await mobileListNotebookSimilarPendingPairs({
        notebookId: input.notebookId,
        vaultId: activeVaultId
      })
      input.setSimilarPairs(pairs)
    })
    .catch(() => input.setSimilarPairs([]))

  await Promise.all([statsTask, mismatchTask, graphTask, similarTask])
}
