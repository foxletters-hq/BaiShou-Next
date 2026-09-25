import { graphNodeCardText, logger, type NotebookGraphNodeRawRecord } from '@baishou/shared'

type PriorCard = {
  id?: string
  name?: string | null
  summary?: string | null
}

/** 只依赖查找/清向量/embedQuery，不绑对齐流水的其余字段。 */
export type NotebookEmbedRefreshDeps = {
  repo: {
    findNodesByNameOrAlias: (
      vaultId: string,
      notebookId: string,
      name: string,
      nodeType?: string
    ) => Promise<PriorCard[]>
    getNodeById?: (id: string, vaultId: string, notebookId: string) => Promise<PriorCard | null>
    clearNodeEmbedding?: (id: string, vaultId: string, notebookId: string) => Promise<void>
  }
  align?: {
    embedQuery?: (text: string) => Promise<number[] | null>
  } | null
}

/** 库里已有节点的名片与本次落库名片是否不同。没有旧行时不算覆盖。 */
export function notebookGraphCardChanged(
  prior: PriorCard | null | undefined,
  next: { name: string; summary?: string | null }
): boolean {
  if (!prior) return false
  return (
    graphNodeCardText(prior.name ?? '', prior.summary) !==
    graphNodeCardText(next.name, next.summary)
  )
}

async function lookupPriorCard(
  deps: NotebookEmbedRefreshDeps,
  vaultId: string,
  notebookId: string,
  node: Pick<NotebookGraphNodeRawRecord, 'id' | 'name' | 'nodeType'>
): Promise<PriorCard | null> {
  if (typeof deps.repo.getNodeById === 'function') {
    const byId = await deps.repo.getNodeById(node.id, vaultId, notebookId)
    if (byId) return byId
  }
  const rows = await deps.repo.findNodesByNameOrAlias(vaultId, notebookId, node.name, node.nodeType)
  return rows.find((row) => row.id === node.id) ?? null
}

/**
 * 抽图覆盖名字或摘要导致名片变化时，按新名片重算向量写入 pending。
 * 对齐阶段的召回向量只对应当时那张名片；算不出新向量则清掉旧的，留给集中补齐。
 * 独立于对齐循环，避免和其他改动抢同一段流水。
 */
export async function refreshNotebookEmbeddingsAfterAlign(
  deps: NotebookEmbedRefreshDeps,
  input: {
    vaultId: string
    notebookId: string
    nodes: Iterable<NotebookGraphNodeRawRecord>
    pendingEmbeddings: Map<string, number[]>
  },
  options?: { requireEmbed?: boolean }
): Promise<void> {
  const embedQuery = deps.align?.embedQuery
  const clear = deps.repo.clearNodeEmbedding?.bind(deps.repo)
  for (const node of input.nodes) {
    if (node.nodeType === 'source' || node.nodeType === 'entry') continue
    const prior = await lookupPriorCard(deps, input.vaultId, input.notebookId, node)
    if (!notebookGraphCardChanged(prior, node)) continue
    if (input.pendingEmbeddings.has(node.id)) continue
    const card = graphNodeCardText(node.name, node.summary)
    let wrote = false
    if (embedQuery) {
      try {
        const embedding = await embedQuery(card)
        if (embedding?.length) {
          input.pendingEmbeddings.set(node.id, embedding)
          wrote = true
        }
      } catch (error) {
        if (options?.requireEmbed) throw error
      }
    }
    if (!wrote && clear) {
      try {
        await clear(node.id, input.vaultId, input.notebookId)
      } catch (error) {
        logger.warn('[KnowledgeGraphExtract] clearNodeEmbedding failed', error as Error)
      }
    }
  }
}
