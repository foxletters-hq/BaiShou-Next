import { vi } from 'vitest'
import { GraphLlmExtractionService } from '../graph-llm-extraction.service'

export const FILE = 'Journal/2026/03/15.md'

export function createService(overrides?: {
  llm?: (input: {
    system: string
    user: string
    signal?: AbortSignal
    onDelta?: (chars: number) => void
    onReasoning?: (chars: number) => void
  }) => Promise<string | null>
  alignDeps?: ConstructorParameters<typeof GraphLlmExtractionService>[7]
  writeRecord?: ReturnType<typeof vi.fn>
  removeRecordsFromShard?: ReturnType<typeof vi.fn>
  listEdgesTouching?: ReturnType<typeof vi.fn>
  syncPendingIndex?: ReturnType<typeof vi.fn>
  searchNodesByVector?: ReturnType<typeof vi.fn>
  getNodeById?: ReturnType<typeof vi.fn>
  findNodeByNameOrAlias?: (vaultId: string, name: string, type?: string) => Promise<unknown>
  findNodesByNameOrAlias?: (vaultId: string, name: string, type?: string) => Promise<unknown[]>
  recountMentions?: ReturnType<typeof vi.fn>
}) {
  const writeRecord = overrides?.writeRecord ?? vi.fn(async () => undefined)
  const removeRecordsFromShard = overrides?.removeRecordsFromShard ?? vi.fn(async () => 0)
  const listEdgesTouching = overrides?.listEdgesTouching ?? vi.fn(async () => [])
  const syncPendingIndex = overrides?.syncPendingIndex ?? vi.fn(async () => undefined)
  const commitReextract = vi.fn(async () => undefined)
  const recountMentions = overrides?.recountMentions ?? vi.fn(async () => undefined)
  const getNodeById = overrides?.getNodeById ?? vi.fn(async () => null)
  const findNodeByNameOrAlias = vi.fn(overrides?.findNodeByNameOrAlias ?? (async () => null))
  const findNodesByNameOrAlias = vi.fn(
    overrides?.findNodesByNameOrAlias ??
      (async (vaultId: string, name: string, type?: string) => {
        const one = await findNodeByNameOrAlias(vaultId, name, type)
        return one ? [one] : []
      })
  )
  const service = new GraphLlmExtractionService(
    {
      writeRecord,
      removeRecordsFromShard,
      supersedeAiEdgesBySourceRef: vi.fn(async () => undefined),
      compactShard: vi.fn(async () => undefined)
    } as never,
    {
      listPendingReextract: vi.fn(async () => [{ filePath: FILE, contentHash: 'hash-1' }]),
      commitReextract
    } as never,
    {
      findNodeByNameOrAlias,
      findNodesByNameOrAlias,
      getNodeById,
      listEdgesTouching,
      searchNodesByName: vi.fn(async () => []),
      searchNodesByVector: overrides?.searchNodesByVector ?? vi.fn(async () => []),
      recountMentions
    } as never,
    { syncPendingIndex } as never,
    { getActiveVaultPath: async () => 'D:/vault' } as never,
    {
      exists: async () => true,
      readFile: async () => '今天和小张吃饭'
    } as never,
    overrides?.llm ??
      (async () =>
        JSON.stringify({
          entities: [
            { name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }
          ],
          edges: [
            { from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }
          ]
        })),
    overrides?.alignDeps
  )
  return {
    service,
    writeRecord,
    removeRecordsFromShard,
    syncPendingIndex,
    commitReextract,
    recountMentions,
    getNodeById
  }
}

export function precomputedFromSync(
  syncPendingIndex: ReturnType<typeof vi.fn>
): Map<string, { embedding: number[]; text: string }> {
  const opts = syncPendingIndex.mock.calls[0]?.[0] as
    | { precomputedNodeEmbeddings?: Map<string, { embedding: number[]; text: string }> }
    | undefined
  return opts?.precomputedNodeEmbeddings ?? new Map()
}
