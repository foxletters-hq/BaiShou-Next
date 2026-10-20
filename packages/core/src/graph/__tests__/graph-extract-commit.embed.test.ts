import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { graphNodeCardText, graphNodeIdForEntity } from '@baishou/shared'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../../raw-data/derived-freshness.service'
import { GraphSyncService } from '../../raw-data/graph-sync.service'
import { GraphRawManager } from '../../raw-data/managers/graph.raw-manager'
import { GraphLlmExtractionService } from '../graph-llm-extraction.service'
import { FILE } from './graph-extract-commit.test-helpers'

describe('GraphLlmExtractionService commitDrafts embed count', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-extract-embed-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should call embedQuery only once for the same new node during one commitDrafts', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const personId = graphNodeIdForEntity(vaultId, 'person', '小张')
    const personCard = graphNodeCardText('小张', '同事')
    const embedQuery = vi.fn(async (_text: string) => [1, 0])
    const freshness = new DerivedFreshnessService()
    freshness.bindPendingReextract({
      loadExtractHashes: async () => new Map(),
      listJournals: async () => [],
      writeExtractState: async () => undefined
    })
    const pathService = {
      getGraphBaseDirectory: async () => path.join(tmpDir, 'Graph'),
      getActiveVaultPath: async () => path.join(tmpDir, 'vault')
    }
    const graphManager = new GraphRawManager(pathService as never, new NodeFileSystem(), freshness)
    const applyRawNode = vi.fn(async (row: { id: string }) => ({ id: row.id }))
    const repo = {
      findNodeByNameOrAlias: vi.fn(async () => null),
      findNodesByNameOrAlias: vi.fn(async () => []),
      getNodeById: vi.fn(async () => null),
      searchNodesByVector: vi.fn(async () => []),
      recountMentions: vi.fn(async () => undefined),
      applyRawNode,
      applyRawEdge: vi.fn(async () => undefined),
      softDeleteNode: vi.fn(async () => undefined),
      softDeleteEdge: vi.fn(async () => undefined),
      listLiveNodeRefs: vi.fn(async () => []),
      listLiveEdgeRefs: vi.fn(async () => []),
      listNodeIds: vi.fn(async () => []),
      listEdgeIds: vi.fn(async () => [])
    }
    const service = new GraphLlmExtractionService(
      graphManager,
      freshness,
      repo as never,
      new GraphSyncService(graphManager, repo as never, { embedQuery, modelId: 'embed-v1' }),
      pathService as never,
      {
        exists: async () => true,
        readFile: async () => '今天和小张吃饭'
      } as never,
      async () =>
        JSON.stringify({
          entities: [
            { name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }
          ],
          edges: [
            { from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }
          ]
        }),
      { embedQuery, modelId: 'embed-v1' }
    )

    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    const personEmbedCalls = embedQuery.mock.calls.filter((call) => call[0] === personCard)
    expect(personEmbedCalls).toHaveLength(1)
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: personId, embedding: [1, 0] })
    )
  })
})
