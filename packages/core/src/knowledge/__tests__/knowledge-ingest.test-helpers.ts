import { describe } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { NotebookRawManager } from '../../raw-data/managers/notebook.raw-manager'
import { KnowledgeIngestService } from '../knowledge-ingest.service'
import type { IStoragePathService } from '../../vault/storage-path.types'

export function canOpenBetterSqlite3(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3')
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}

export const describeIngest = canOpenBetterSqlite3() ? describe : describe.skip

export type KnowledgeIngestRepo = {
  getSource: (id: string) => Promise<any>
  insertChunk: (p: any) => Promise<void>
  deleteChunksBySource: (id: string) => Promise<void>
  searchChunksLike: (nb: string, q: string) => Promise<any[]>
  getEmbedLedger: (vaultId: string, sourceId: string) => Promise<any>
}

export type KnowledgeIngestContext = {
  tempDir: string
  notebooksDir: string
  repo: KnowledgeIngestRepo
  svc: KnowledgeIngestService
  graphExtractCalls: Array<{ sourceId: string; force?: boolean }>
  cleanup: () => Promise<void>
}

export async function setupKnowledgeIngest(): Promise<KnowledgeIngestContext> {
  const { KnowledgeConnectionManager, KnowledgeRepository } = await import('@baishou/database')
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-kb-ingest-'))
  const notebooksDir = path.join(tempDir, 'Notebooks')
  await fs.mkdir(notebooksDir, { recursive: true })

  const dbManager = new KnowledgeConnectionManager()
  await dbManager.connect(tempDir)
  const knowledgeRepo = new KnowledgeRepository(dbManager.getDb())
  const repo = knowledgeRepo as KnowledgeIngestRepo

  const fsApi = createNodeFileSystem()
  const pathService = {
    getNotebooksBaseDirectory: async () => notebooksDir,
    getActiveVaultPath: async () => tempDir
  } as unknown as IStoragePathService
  const notebookManager = new NotebookRawManager(pathService, fsApi)
  const graphExtractCalls: Array<{ sourceId: string; force?: boolean }> = []

  const svc = new KnowledgeIngestService({
    repo: knowledgeRepo,
    notebookManager,
    fs: fsApi,
    getVaultId: () => 'vault_test',
    embedding: {
      isConfigured: true,
      getModelId: () => 'mock-emb',
      getProviderInstance: async () => null
    },
    embedText: async (text) => {
      const dim = 8
      const v = new Array(dim).fill(0)
      for (let i = 0; i < text.length; i++) v[i % dim] += text.charCodeAt(i) / 1000
      return v
    },
    insertChunk: async (params) => {
      await knowledgeRepo.insertChunk({
        chunkId: params.chunkId,
        notebookId: params.notebookId,
        sourceId: params.sourceId,
        chunkIndex: params.chunkIndex,
        chunkText: params.chunkText,
        metadataJson: params.metadataJson,
        embedding: Buffer.from(new Float32Array(params.embedding).buffer),
        dimension: params.embedding.length,
        modelId: params.modelId,
        vaultId: params.vaultId
      })
    },
    deleteChunksBySource: (id) => knowledgeRepo.deleteChunksBySource(id),
    extractNotebookGraph: async (input) => {
      graphExtractCalls.push({ sourceId: input.sourceId, force: input.force })
    }
  })

  return {
    tempDir,
    notebooksDir,
    repo,
    svc,
    graphExtractCalls,
    cleanup: async () => {
      dbManager.disconnect()
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}
