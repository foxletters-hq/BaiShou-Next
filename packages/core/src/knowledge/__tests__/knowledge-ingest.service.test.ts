import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { NotebookRawManager } from '../../raw-data/managers/notebook.raw-manager'
import { KnowledgeIngestService } from '../knowledge-ingest.service'
import { analyzePageTexts, classifyExtractQuality } from '../knowledge-extract'
import type { IStoragePathService } from '../../vault/storage-path.types'

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

describe('knowledge extract quality', () => {
  it('按页统计三态', () => {
    expect(classifyExtractQuality(10, 10).quality).toBe('ok')
    expect(classifyExtractQuality(10, 5).quality).toBe('partial')
    expect(classifyExtractQuality(10, 0).quality).toBe('needs_ocr')
  })

  it('产出页边界表', () => {
    const result = analyzePageTexts(['aaa', 'bbbb'])
    expect(result.pages.pages).toEqual([
      { page: 1, start: 0, end: 3 },
      { page: 2, start: 5, end: 9 }
    ])
    expect(result.text).toBe('aaa\n\nbbbb')
  })
})

const describeIngest = canOpenBetterSqlite3() ? describe : describe.skip

describeIngest('KnowledgeIngestService import → retrieve', () => {
  let tempDir: string
  let notebooksDir: string
  let dbManager: { connect: (d: string) => Promise<void>; disconnect: () => void; getDb: () => any }
  let svc: KnowledgeIngestService
  let repo: {
    getSource: (id: string) => Promise<any>
    insertChunk: (p: any) => Promise<void>
    deleteChunksBySource: (id: string) => Promise<void>
    searchChunksLike: (nb: string, q: string) => Promise<any[]>
  }

  beforeEach(async () => {
    const { KnowledgeConnectionManager, KnowledgeRepository } = await import('@baishou/database')
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-kb-ingest-'))
    notebooksDir = path.join(tempDir, 'Notebooks')
    await fs.mkdir(notebooksDir, { recursive: true })

    dbManager = new KnowledgeConnectionManager()
    await dbManager.connect(tempDir)
    const knowledgeRepo = new KnowledgeRepository(dbManager.getDb())
    repo = knowledgeRepo

    const fsApi = createNodeFileSystem()
    const pathService = {
      getNotebooksBaseDirectory: async () => notebooksDir,
      getActiveVaultPath: async () => tempDir
    } as unknown as IStoragePathService
    const notebookManager = new NotebookRawManager(pathService, fsApi)

    svc = new KnowledgeIngestService({
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
      deleteChunksBySource: (id) => knowledgeRepo.deleteChunksBySource(id)
    })
  })

  afterEach(() => {
    dbManager.disconnect()
    return fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('粘贴文本导入后可检索', async () => {
    const { id: notebookId } = await svc.createNotebook({ name: '研究本' })
    const body =
      '白守知识库使用独立 knowledge.db 存放向量笔记本。对齐问题是 AI 安全的核心议题之一。'
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: body
    })

    await svc.processExtractJob(sourceId)
    await svc.processEmbedJob(sourceId)

    const source = await repo.getSource(sourceId)
    expect(source?.status).toBe('ready')
    expect(source?.extractedTextHash).toBeTruthy()
    expect(source?.vaultId).toBe('vault_test')

    const pagesPath = path.join(notebooksDir, notebookId, 'extracted', `${sourceId}.pages.json`)
    const pagesRaw = await fs.readFile(pagesPath, 'utf8')
    const pages = JSON.parse(pagesRaw)
    expect(pages.pages?.length).toBeGreaterThan(0)

    const hits = await repo.searchChunksLike(notebookId, 'knowledge.db')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.chunkText).toContain('knowledge.db')
  })

  it('同名文件导入使用 sourceId 前缀避免覆盖', async () => {
    const { id: notebookId } = await svc.createNotebook({ name: '文件本' })
    const a = path.join(tempDir, 'a.txt')
    const b = path.join(tempDir, 'b.txt')
    await fs.writeFile(a, 'content-a', 'utf8')
    await fs.writeFile(b, 'content-b', 'utf8')

    const { sourceId: id1 } = await svc.importSource({
      notebookId,
      title: 'same.txt',
      kind: 'file',
      absolutePath: a,
      fileName: 'same.txt'
    })
    const { sourceId: id2 } = await svc.importSource({
      notebookId,
      title: 'same.txt',
      kind: 'file',
      absolutePath: b,
      fileName: 'same.txt'
    })

    const s1 = await repo.getSource(id1)
    const s2 = await repo.getSource(id2)
    expect(s1?.relativePath).toContain(`${id1}_same.txt`)
    expect(s2?.relativePath).toContain(`${id2}_same.txt`)
    expect(s1?.relativePath).not.toBe(s2?.relativePath)

    const text1 = await fs.readFile(path.join(notebooksDir, s1!.relativePath!), 'utf8')
    const text2 = await fs.readFile(path.join(notebooksDir, s2!.relativePath!), 'utf8')
    expect(text1).toBe('content-a')
    expect(text2).toBe('content-b')
  })

  it('取消普通导入 → failed，取消 OCR 排队 → needs_ocr', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '取消本' })

    const { sourceId: textId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '普通导入待提取'
    })
    const cancelledImport = await svc.cancelExtract(textId)
    expect(cancelledImport.status).toBe('failed')
    const textSource = await knowledgeRepo.getSource(textId)
    expect(textSource?.status).toBe('failed')
    expect(textSource?.errorMessage).toBe('cancelled')

    const { sourceId: ocrId } = await svc.importSource({
      notebookId,
      title: 'ocr-target',
      kind: 'text',
      textContent: '占位'
    })
    await knowledgeRepo.updateSourceStatus(ocrId, 'needs_ocr', {
      pageCount: 3,
      textPageCount: 0,
      extractEngine: 'simple',
      errorMessage: null
    })
    await svc.ocrMissingPages(ocrId, { engine: 'ocr' })
    const queued = await knowledgeRepo.getSource(ocrId)
    expect(queued?.status).toBe('pending')
    expect(queued?.extractEngine).toBe('ocr')

    const cancelledOcr = await svc.cancelExtract(ocrId)
    expect(cancelledOcr.status).toBe('needs_ocr')
    const after = await knowledgeRepo.getSource(ocrId)
    expect(after?.status).toBe('needs_ocr')
  })

  it('recoverStale 跳过 live guard 保护的 extract', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const {
      markExtractJobLive,
      unmarkExtractJobLive
    } = await import('../knowledge-ingest.service')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '恢复本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'stale',
      kind: 'text',
      textContent: 'x'
    })
    await knowledgeRepo.updateSourceStatus(sourceId, 'extracting')
    await knowledgeRepo.enqueueIngestJob({
      notebookId,
      sourceId,
      stage: 'extract',
      vaultId: 'vault_test'
    })
    const claimed = await knowledgeRepo.claimIngestJobs(1)
    expect(claimed).toHaveLength(1)

    markExtractJobLive(sourceId)
    try {
      const protectedRecover = await svc.recoverStaleIngestState()
      expect(protectedRecover.droppedExtractJobs).toBe(0)
      expect(protectedRecover.resetSources).toBe(0)
      const still = await knowledgeRepo.getSource(sourceId)
      expect(still?.status).toBe('extracting')
    } finally {
      unmarkExtractJobLive(sourceId)
    }

    const cleared = await svc.recoverStaleIngestState()
    expect(cleared.droppedExtractJobs + cleared.resetSources).toBeGreaterThan(0)
    const after = await knowledgeRepo.getSource(sourceId)
    expect(after?.status).toBe('failed')
  })
})
