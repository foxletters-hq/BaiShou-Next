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
  let graphExtractCalls: Array<{ sourceId: string; force?: boolean }>
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
    graphExtractCalls = []

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
      deleteChunksBySource: (id) => knowledgeRepo.deleteChunksBySource(id),
      extractNotebookGraph: async (input) => {
        graphExtractCalls.push({ sourceId: input.sourceId, force: input.force })
      }
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

    const fresh = await svc.recoverStaleIngestState()
    expect(fresh.droppedExtractJobs).toBe(0)
    expect(fresh.resetSources).toBe(0)
    expect(fresh.reclaimedEmbedJobs).toBe(0)
    const still = await knowledgeRepo.getSource(sourceId)
    expect(still?.status).toBe('extracting')
    const runningJob = (await knowledgeRepo.listIngestJobs()).find(
      (j) => j.sourceId === sourceId && j.stage === 'extract'
    )
    expect(runningJob?.status).toBe('running')

    const stale = await svc.recoverStaleIngestState({ olderThanMs: 0 })
    expect(stale.droppedExtractJobs).toBe(0)
    expect(stale.reclaimedEmbedJobs).toBeGreaterThan(0)
    const after = await knowledgeRepo.getSource(sourceId)
    expect(after?.status).toBe('extracting')
    const reclaimed = (await knowledgeRepo.listIngestJobs()).find(
      (j) => j.sourceId === sourceId && j.stage === 'extract'
    )
    expect(reclaimed?.status).toBe('pending')
  })

  it('recoverStale 对 extracting 且无 extract job 的资料重新入队', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '缺 job 本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'stale-pdf',
      kind: 'text',
      textContent: 'x'
    })
    await knowledgeRepo.deleteIngestJobsForSource(sourceId, 'extract')
    await knowledgeRepo.updateSourceStatus(sourceId, 'extracting')

    const recovered = await svc.recoverStaleIngestState()
    expect(recovered.resetSources).toBe(1)
    const after = await knowledgeRepo.getSource(sourceId)
    expect(after?.status).toBe('pending')
    const extractJob = (await knowledgeRepo.listIngestJobs()).find(
      (j) => j.sourceId === sourceId && j.stage === 'extract'
    )
    expect(extractJob?.status).toBe('pending')
  })

  it('claim 可按 stage 只取 embed，不受 running graph 挡住', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '分车道本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'pdf-embed',
      kind: 'text',
      textContent: '待嵌入正文'
    })
    await knowledgeRepo.enqueueIngestJob({
      notebookId,
      sourceId,
      stage: 'graph',
      vaultId: 'vault_test'
    })
    await knowledgeRepo.enqueueIngestJob({
      notebookId,
      sourceId,
      stage: 'embed',
      vaultId: 'vault_test'
    })
    const graphClaimed = await knowledgeRepo.claimIngestJobs(8, {
      vaultId: 'vault_test',
      stages: ['graph']
    })
    expect(graphClaimed.every((j) => j.stage === 'graph')).toBe(true)
    expect(graphClaimed.length).toBeGreaterThan(0)

    const embedClaimed = await knowledgeRepo.claimIngestJobs(8, {
      vaultId: 'vault_test',
      stages: ['embed']
    })
    expect(embedClaimed.every((j) => j.stage === 'embed')).toBe(true)
    expect(embedClaimed.some((j) => j.sourceId === sourceId)).toBe(true)
    expect(
      await knowledgeRepo.countIngestJobs({
        vaultId: 'vault_test',
        stages: ['embed'],
        claimableOnly: true
      })
    ).toBe(0)
  })

  it('enqueue 不重置 running；claim 带 CAS；pendingJobs 不串本', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: nbA } = await svc.createNotebook({ name: '本A' })
    const { id: nbB } = await svc.createNotebook({ name: '本B' })
    const { sourceId: srcA } = await svc.importSource({
      notebookId: nbA,
      title: 'a',
      kind: 'text',
      textContent: 'aaa'
    })
    const { sourceId: srcB } = await svc.importSource({
      notebookId: nbB,
      title: 'b',
      kind: 'text',
      textContent: 'bbb'
    })

    const claimed = await knowledgeRepo.claimIngestJobs(1, { vaultId: 'vault_test' })
    expect(claimed.length).toBeGreaterThan(0)
    const runningId = claimed[0]!.id
    const before = (await knowledgeRepo.listIngestJobs()).find((j) => j.id === runningId)
    const beforeAt = before!.updatedAt
    await new Promise((resolve) => setTimeout(resolve, 15))
    await knowledgeRepo.enqueueIngestJob({
      notebookId: claimed[0]!.notebookId,
      sourceId: claimed[0]!.sourceId,
      stage: claimed[0]!.stage,
      vaultId: 'vault_test'
    })
    const stillRunning = (await knowledgeRepo.listIngestJobs()).find((j) => j.id === runningId)
    expect(stillRunning?.status).toBe('running')
    expect(stillRunning?.updatedAt).toBe(beforeAt)

    const claimedAgain = await knowledgeRepo.claimIngestJobs(8, { vaultId: 'vault_test' })
    expect(claimedAgain.some((j) => j.id === runningId)).toBe(false)

    const statsA = await knowledgeRepo.getStats(nbA, 'vault_test')
    const statsB = await knowledgeRepo.getStats(nbB, 'vault_test')
    expect(statsA.pendingJobs).toBeGreaterThan(0)
    expect(statsA.pendingJobs).not.toBe(statsB.pendingJobs + statsA.pendingJobs + 99)
    const listed = await knowledgeRepo.listNotebookStats('vault_test')
    const rowA = listed.find((r) => r.notebookId === nbA)
    const rowB = listed.find((r) => r.notebookId === nbB)
    expect(rowA?.pendingJobs).toBe(statsA.pendingJobs)
    expect(rowB?.pendingJobs).toBe(statsB.pendingJobs)
    expect(srcA && srcB).toBeTruthy()
  })

  it('创建时可写封面色，并按给定顺序重排', async () => {
    const a = await svc.createNotebook({ name: '本A', coverTone: 'mint' })
    const b = await svc.createNotebook({ name: '本B', coverTone: 'peach' })
    expect(a.coverTone).toBe('mint')
    expect(b.coverTone).toBe('peach')
    expect(b.sortOrder).toBeGreaterThan(a.sortOrder)

    const reordered = await svc.reorderNotebooks([b.id, a.id])
    expect(reordered.map((row) => row.id)).toEqual([b.id, a.id])
    expect(reordered[0]?.sortOrder).toBe(0)
    expect(reordered[1]?.sortOrder).toBe(1)

    const updated = await svc.updateNotebook({ notebookId: a.id, coverTone: 'sky' })
    expect(updated.coverTone).toBe('sky')

    const listed = await svc.listNotebooks()
    expect(listed.map((row) => row.id)).toEqual([b.id, a.id])
    expect(listed.find((row) => row.id === a.id)?.coverTone).toBe('sky')
  })

  it('可写封面 emoji 并上传封面图', async () => {
    const a = await svc.createNotebook({ name: '本A', coverIcon: '✨' })
    expect(a.coverIcon).toBe('✨')

    const updated = await svc.updateNotebook({ notebookId: a.id, coverIcon: '🧭' })
    expect(updated.coverIcon).toBe('🧭')

    const png = path.join(tempDir, 'cover.png')
    await fs.writeFile(
      png,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
    )
    const withImage = await svc.setCoverImage({ notebookId: a.id, absolutePath: png })
    expect(withImage.coverImage).toBe(`${a.id}/cover.png`)
    await fs.access(path.join(notebooksDir, a.id, 'cover.png'))

    await svc.updateNotebook({ notebookId: a.id, coverImage: '' })
    const listed = await svc.listNotebooks()
    expect(listed.find((row) => row.id === a.id)?.coverImage).toBe('')
    await expect(fs.access(path.join(notebooksDir, a.id, 'cover.png'))).rejects.toBeTruthy()
  })

  it('导入时可只入队向量或只入队图关系', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '分模式本' })

    const { sourceId: vectorId } = await svc.importSource({
      notebookId,
      title: 'vector',
      kind: 'text',
      textContent: '这份正文只写入向量',
      importProcessMode: 'vector'
    })
    await svc.processExtractJob(vectorId)
    const vectorJobs = (await knowledgeRepo.listIngestJobsBySource(vectorId)).map(
      (job) => job.stage
    )
    expect(vectorJobs.filter((stage) => stage !== 'extract')).toEqual(['embed'])
    expect((await knowledgeRepo.getSource(vectorId))?.status).toBe('embedding')
    expect((await knowledgeRepo.getSource(vectorId))?.extractedTextHash).toBeTruthy()

    const { sourceId: graphId } = await svc.importSource({
      notebookId,
      title: 'graph',
      kind: 'text',
      textContent: '这份正文只抽取图关系',
      importProcessMode: 'graph'
    })
    await svc.processExtractJob(graphId)
    const graphJobs = (await knowledgeRepo.listIngestJobsBySource(graphId)).map((job) => job.stage)
    expect(graphJobs.filter((stage) => stage !== 'extract')).toEqual(['graph'])
    expect((await knowledgeRepo.getSource(graphId))?.status).toBe('ready')
    expect((await knowledgeRepo.getSource(graphId))?.extractedTextHash).toBeTruthy()
  })

  it('删除资料会去掉原文和任务', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '删除本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '待删除'
    })
    const source = await knowledgeRepo.getSource(sourceId)
    const abs = path.join(notebooksDir, source!.relativePath!)
    await fs.access(abs)
    await svc.deleteSource(sourceId)
    expect(await knowledgeRepo.getSource(sourceId)).toBeFalsy()
    await expect(fs.access(abs)).rejects.toBeTruthy()
    expect(await knowledgeRepo.listIngestJobsBySource(sourceId)).toHaveLength(0)
  })

  it('重新处理可只入队向量或只入队图数据', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '重嵌本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '已经有正文的资料'
    })
    await svc.processExtractJob(sourceId)
    await knowledgeRepo.deleteIngestJobsForSource(sourceId)
    await knowledgeRepo.updateSourceStatus(sourceId, 'ready')

    await svc.reprocessSource(sourceId, 'embed')
    const afterEmbed = await knowledgeRepo.listIngestJobsBySource(sourceId)
    expect(afterEmbed.map((job) => job.stage)).toEqual(['embed'])
    expect((await knowledgeRepo.getSource(sourceId))?.status).toBe('pending')

    await knowledgeRepo.deleteIngestJobsForSource(sourceId)
    await knowledgeRepo.updateSourceStatus(sourceId, 'ready')
    await svc.reprocessSource(sourceId, 'graph')
    const afterGraph = await knowledgeRepo.listIngestJobsBySource(sourceId)
    expect(afterGraph.map((job) => job.stage)).toEqual(['graph'])
    expect((await knowledgeRepo.getSource(sourceId))?.status).toBe('ready')
    await svc.processGraphJob(sourceId)
    expect(graphExtractCalls).toEqual([{ sourceId, force: true }])
  })
})
