import { GraphReaderAdapter } from '@baishou/ai'
import { GraphRagService } from '@baishou/core-desktop'
import { connectionManager, GraphRepository } from '@baishou/database-desktop'
import type { ToolGraphReader } from '@baishou/shared'
import { resolveActiveVaultId } from '../ipc/vault.ipc'

/**
 * 人生关系图只读检索（recall_relations）。
 * agent.db 未连接时返回 undefined；连接状态在每次检索时重新读取，避免热切换后拿到旧句柄。
 */
export function createDesktopGraphReader(
  embedQuery?: (text: string) => Promise<number[] | null>
): ToolGraphReader | undefined {
  if (!connectionManager.isConnected()) return undefined

  return new GraphReaderAdapter(async (opts) => {
    const rag = new GraphRagService(new GraphRepository(connectionManager.getDb()))
    const result = await rag.recallRelations({
      vaultId: resolveActiveVaultId(),
      entity: opts.entity,
      mode: opts.mode,
      depth: opts.depth,
      nodeType: opts.nodeType,
      limit: opts.limit,
      embedQuery
    })
    return {
      anchors: result.anchors.map((a) => ({
        id: a.id,
        name: a.name,
        nodeType: a.nodeType,
        summary: a.summary
      })),
      subgraph: result.subgraph.map((e) => ({
        id: e.id,
        fromId: e.fromId,
        toId: e.toId,
        edgeType: e.edgeType,
        sourceRef: e.sourceRef,
        sourceExcerpt: e.sourceExcerpt,
        validFrom: e.validFrom
      })),
      timeline: result.timeline?.map((e) => ({
        id: e.id,
        fromId: e.fromId,
        toId: e.toId,
        edgeType: e.edgeType,
        sourceRef: e.sourceRef,
        sourceExcerpt: e.sourceExcerpt,
        validFrom: e.validFrom
      })),
      nodes: result.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        nodeType: n.nodeType,
        summary: n.summary
      })),
      paths: (result.paths ?? []).map((p) => ({
        nodeIds: p.nodeIds,
        nodeNames: p.nodeNames,
        edges: p.edges.map((e) => ({
          id: e.id,
          fromId: e.fromId,
          toId: e.toId,
          edgeType: e.edgeType,
          sourceRef: e.sourceRef,
          sourceExcerpt: e.sourceExcerpt
        })),
        edgeDirections: p.edgeDirections
      }))
    }
  })
}
