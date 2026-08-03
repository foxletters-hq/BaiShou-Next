import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { NotebookRawManager } from '../../raw-data/managers/notebook.raw-manager'
import { KnowledgeHydrationService } from '../knowledge-hydration.service'
import type { IStoragePathService } from '../../vault/storage-path.types'
import { md5Hex } from '../../fs/md5'

function canOpenBetterSqlite3(): boolean {
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

const describeHydration = canOpenBetterSqlite3() ? describe : describe.skip

describeHydration('KnowledgeHydrationService', () => {
  let tempDir: string
  let notebooksDir: string
  let dbManager: { connect: (d: string) => Promise<void>; disconnect: () => void; getDb: () => any }
  let repo: import('@baishou/database').KnowledgeRepository
  let notebookManager: NotebookRawManager

  beforeEach(async () => {
    const { KnowledgeConnectionManager, KnowledgeRepository } = await import('@baishou/database')
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-kb-hydrate-'))
    notebooksDir = path.join(tempDir, 'Notebooks')
    await fs.mkdir(notebooksDir, { recursive: true })

    dbManager = new KnowledgeConnectionManager()
    await dbManager.connect(tempDir)
    repo = new KnowledgeRepository(dbManager.getDb())

    const fsApi = createNodeFileSystem()
    const pathService = {
      getNotebooksBaseDirectory: async () => notebooksDir,
      getActiveVaultPath: async () => tempDir
    } as unknown as IStoragePathService
    notebookManager = new NotebookRawManager(pathService, fsApi)
  })

  afterEach(() => {
    dbManager?.disconnect()
  })

  it('差集排 embed job；无嵌入模型时跳过排队', async () => {
    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb1',
      name: '研究',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await notebookManager.appendSourceRecord('nb1', {
      id: 'src1',
      title: '笔记',
      kind: 'text',
      path: 'sources/src1.txt',
      contentHash: 'abc',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    const text = '知识库换端只重嵌，不重跑 OCR。'
    await notebookManager.writeExtracted('nb1', 'src1', text)

    const skipped = new KnowledgeHydrationService({
      repo,
      notebookManager,
      isEmbeddingConfigured: () => false
    })
    const skipResult = await skipped.hydrate()
    expect(skipResult.sourcesUpserted).toBe(1)
    expect(skipResult.embedJobsEnqueued).toBe(0)
    expect(skipResult.skipped).toBe('embedding-not-configured')

    const withEmbed = new KnowledgeHydrationService({
      repo,
      notebookManager,
      isEmbeddingConfigured: () => true
    })
    const result = await withEmbed.hydrate()
    expect(result.embedJobsEnqueued).toBe(1)
    const jobs = await repo.listIngestJobs()
    expect(jobs.some((j) => j.sourceId === 'src1' && j.stage === 'embed')).toBe(true)

    // 模拟已嵌入：写入 chunk 后再次 hydrate 不应重复排队
    await repo.insertChunk({
      chunkId: 'src1_0',
      notebookId: 'nb1',
      sourceId: 'src1',
      chunkIndex: 0,
      chunkText: text,
      embedding: Buffer.from(new Float32Array(4).buffer),
      dimension: 4,
      modelId: 'mock'
    })
    await repo.updateSourceStatus('src1', 'ready', { extractedTextHash: md5Hex(text) })
    await repo.completeIngestJob(jobs[0]!.id)

    const again = await withEmbed.hydrate()
    expect(again.embedJobsEnqueued).toBe(0)
  })

  it('orphan 清理：磁盘已删的 source 从库移除', async () => {
    await repo.createNotebook({ id: 'nb1', name: '研究' })
    await repo.upsertSource({
      id: 'orphan',
      notebookId: 'nb1',
      title: '幽灵',
      sourceKind: 'text',
      contentHash: 'x',
      status: 'ready'
    })
    await repo.insertChunk({
      chunkId: 'orphan_0',
      notebookId: 'nb1',
      sourceId: 'orphan',
      chunkIndex: 0,
      chunkText: 'gone',
      embedding: Buffer.from(new Float32Array(2).buffer),
      dimension: 2,
      modelId: 'mock'
    })

    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb1',
      name: '研究',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      isEmbeddingConfigured: () => true
    })
    const result = await svc.hydrate()
    expect(result.orphansCleaned).toBeGreaterThanOrEqual(1)
    expect(await repo.getSource('orphan')).toBeNull()
    expect(await repo.listChunksBySource('orphan')).toEqual([])
  })
})
