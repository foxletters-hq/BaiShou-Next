import { vi } from 'vitest'
import { notebookGraphNodeIdForEntity } from '@baishou/shared'
import { KnowledgeGraphExtractionService } from '../knowledge-graph-extraction.service'

export const VAULT = 'vlt_aaaaaaaaaaaaaaaa'
export const NB_THIS = 'nb-this'
export const NB_OTHER = 'nb-other'

export function personId(notebookId: string, name: string): string {
  return notebookGraphNodeIdForEntity(VAULT, notebookId, 'person', name)
}

export function extractJson(name = '小张', summary = '同事') {
  return JSON.stringify({
    entities: [{ name, type: 'person', aliases: [], summary, confidence: 90 }],
    edges: []
  })
}

export function createService(overrides?: {
  llm?: (input: { system: string; user: string }) => Promise<string | null>
  findNodeByName?: (
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ) => Promise<unknown>
  findNodesByNameOrAlias?: (
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ) => Promise<unknown[]>
  searchNodesByVector?: ReturnType<typeof vi.fn>
  updateNodeEmbedding?: ReturnType<typeof vi.fn>
  embedQuery?: (text: string) => Promise<number[] | null>
  modelId?: string
  captureEdges?: boolean
}) {
  const nodes: Array<Record<string, unknown>> = []
  const edges: Array<Record<string, unknown>> = []
  const findNodeByName = vi.fn(overrides?.findNodeByName ?? (async () => null))
  const findNodesByNameOrAlias = vi.fn(
    overrides?.findNodesByNameOrAlias ??
      (async (vaultId: string, notebookId: string, name: string, nodeType?: string) => {
        const one = await findNodeByName(vaultId, notebookId, name, nodeType)
        return one ? [one] : []
      })
  )
  const searchNodesByVector = overrides?.searchNodesByVector ?? vi.fn(async () => [])
  const updateNodeEmbedding = overrides?.updateNodeEmbedding ?? vi.fn(async () => undefined)
  const service = new KnowledgeGraphExtractionService({
    raw: {
      getExtractState: vi.fn(async () => null),
      replaceSourceGraph: vi.fn(
        async (input: {
          nodes: Array<Record<string, unknown>>
          edges?: Array<Record<string, unknown>>
        }) => {
          nodes.length = 0
          edges.length = 0
          for (const record of input.nodes) {
            if (record.nodeType === 'person') nodes.push(record)
          }
          if (overrides?.captureEdges && input.edges) {
            edges.push(...input.edges)
          }
        }
      )
    } as never,
    repo: {
      findNodeByName,
      findNodesByNameOrAlias,
      searchNodesByVector,
      updateNodeEmbedding,
      supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
    } as never,
    index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
    llm: overrides?.llm ?? (async () => extractJson()),
    getVaultName: () => 'Personal',
    align:
      overrides?.embedQuery || overrides?.modelId
        ? { embedQuery: overrides.embedQuery, modelId: overrides.modelId ?? 'embed-v1' }
        : undefined
  })
  return {
    service,
    nodes,
    edges,
    findNodeByName,
    findNodesByNameOrAlias,
    searchNodesByVector,
    updateNodeEmbedding
  }
}

export async function extractIn(service: KnowledgeGraphExtractionService, notebookId: string) {
  return service.extractSource({
    vaultId: VAULT,
    notebookId,
    sourceId: 'src1',
    sourceTitle: '资料',
    text: '小张出现了',
    textHash: 'h-align'
  })
}
