import { it, expect, beforeEach, afterEach } from 'vitest'
import { KnowledgeIngestService } from '../knowledge-ingest.service'
import type { IStoragePathService } from '../../vault/storage-path.types'
import type { KnowledgeIngestContext, KnowledgeIngestRepo } from './knowledge-ingest.test-helpers'
import { describeIngest, setupKnowledgeIngest } from './knowledge-ingest.test-helpers'

describeIngest('KnowledgeIngestService import modes and reprocess', () => {
  let ctx: KnowledgeIngestContext
  let tempDir: string
  let notebooksDir: string
  let svc: KnowledgeIngestService
  let repo: KnowledgeIngestRepo
  let graphExtractCalls: Array<{ sourceId: string; force?: boolean }>

  beforeEach(async () => {
    ctx = await setupKnowledgeIngest()
    tempDir = ctx.tempDir
    notebooksDir = ctx.notebooksDir
    svc = ctx.svc
    repo = ctx.repo
    graphExtractCalls = ctx.graphExtractCalls
  })

  afterEach(() => ctx.cleanup())

  it('导入时可稍后整理：只保存文件，不入队提取或嵌入', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '稍后整理本' })

    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'later',
      kind: 'text',
      textContent: '这份正文先不整理',
      importProcessMode: 'later'
    })
    expect((await knowledgeRepo.getSource(sourceId))?.status).toBe('stored')
    expect(await knowledgeRepo.listIngestJobsBySource(sourceId)).toHaveLength(0)
    expect((await knowledgeRepo.getSource(sourceId))?.extractedTextHash).toBeFalsy()
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
    expect(graphJobs.filter((stage) => stage !== 'extract')).toEqual(['embed'])
    expect((await knowledgeRepo.getSource(graphId))?.status).toBe('embedding')
    expect((await knowledgeRepo.getSource(graphId))?.extractedTextHash).toBeTruthy()
    await svc.processEmbedJob(graphId)
    expect((await knowledgeRepo.listIngestJobsBySource(graphId)).map((job) => job.stage)).toEqual(
      expect.arrayContaining(['embed', 'graph'])
    )
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
    expect((await knowledgeRepo.listIngestJobsBySource(sourceId)).map((job) => job.stage)).toEqual([
      'embed'
    ])
  })

  it('should return zero queued jobs when reprocessing an empty notebook', async () => {
    const { id: notebookId } = await svc.createNotebook({ name: '空本' })
    const result = await svc.manageNotebookData(notebookId, {
      action: 'reprocess',
      vector: true,
      graph: true
    })
    expect(result).toMatchObject({
      action: 'reprocess',
      sourceCount: 0,
      vectorQueued: 0,
      graphQueued: 0
    })
  })

  it('should return queued counts when reprocessing extracted sources', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '整本重整理' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '已经有正文的资料'
    })
    await svc.processExtractJob(sourceId)
    await knowledgeRepo.deleteIngestJobsForSource(sourceId)
    await knowledgeRepo.updateSourceStatus(sourceId, 'ready')

    const result = await svc.manageNotebookData(notebookId, {
      action: 'reprocess',
      vector: true,
      graph: true
    })
    expect(result).toMatchObject({
      action: 'reprocess',
      sourceCount: 1,
      vectorQueued: 1,
      graphQueued: 1
    })
    const jobs = (await knowledgeRepo.listIngestJobsBySource(sourceId)).map((job) => job.stage)
    expect(jobs).toEqual(['embed'])
    expect((await knowledgeRepo.getSource(sourceId))?.status).toBe('pending')
    await svc.processEmbedJob(sourceId)
    expect((await knowledgeRepo.listIngestJobsBySource(sourceId)).map((job) => job.stage)).toEqual(
      expect.arrayContaining(['embed', 'graph'])
    )
  })

  it('should queue embed only after extract when both organize targets are on', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '串行本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '抽出正文后先向量再抽图'
    })
    await svc.processExtractJob(sourceId)
    const afterExtract = (await knowledgeRepo.listIngestJobsBySource(sourceId)).map(
      (job) => job.stage
    )
    expect(afterExtract.filter((stage) => stage !== 'extract')).toEqual(['embed'])
    expect(afterExtract).not.toContain('graph')
  })

  it('should queue graph only after embed succeeds', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '接续本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '向量完成后再排抽图'
    })
    await svc.processExtractJob(sourceId)
    await knowledgeRepo.deleteIngestJobsForSource(sourceId, 'extract')
    await svc.processEmbedJob(sourceId)
    const stages = (await knowledgeRepo.listIngestJobsBySource(sourceId)).map((job) => job.stage)
    expect(stages).toContain('graph')
    expect(stages.filter((stage) => stage === 'graph')).toHaveLength(1)
  })

  it('should not queue graph when embed fails', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { createNodeFileSystem } = await import('../../fs/create-node-file-system')
    const { NotebookRawManager } = await import('../../raw-data/managers/notebook.raw-manager')
    const { KnowledgeIngestService } = await import('../knowledge-ingest.service')
    const { id: notebookId } = await svc.createNotebook({ name: '失败本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '嵌入失败不应排抽图'
    })
    await svc.processExtractJob(sourceId)
    const failSvc = new KnowledgeIngestService({
      repo: knowledgeRepo,
      notebookManager: new NotebookRawManager(
        {
          getNotebooksBaseDirectory: async () => notebooksDir,
          getActiveVaultPath: async () => tempDir
        } as unknown as IStoragePathService,
        createNodeFileSystem()
      ),
      fs: createNodeFileSystem(),
      getVaultId: () => 'vault_test',
      embedding: {
        isConfigured: true,
        getModelId: () => 'mock-emb',
        getProviderInstance: async () => null
      },
      embedText: async () => {
        throw new Error('embed boom')
      },
      insertChunk: async () => undefined,
      deleteChunksBySource: (id) => knowledgeRepo.deleteChunksBySource(id),
      extractNotebookGraph: async () => undefined
    })
    await expect(failSvc.processEmbedJob(sourceId)).rejects.toThrow('embed boom')
    expect(
      (await knowledgeRepo.listIngestJobsBySource(sourceId)).some((job) => job.stage === 'graph')
    ).toBe(false)
  })

  it('should queue embed then graph when reprocessing graph before chunks are embedded', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '门槛本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '还没有分块向量'
    })
    await svc.processExtractJob(sourceId)
    await knowledgeRepo.deleteIngestJobsForSource(sourceId)
    await knowledgeRepo.updateSourceStatus(sourceId, 'ready')
    await svc.reprocessSource(sourceId, 'graph')
    expect((await knowledgeRepo.listIngestJobsBySource(sourceId)).map((job) => job.stage)).toEqual([
      'embed'
    ])
  })

  it('should queue embed then graph when rebuilding notebook graph for unembedded sources', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '整本图门槛' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '整本重建时先补向量再抽图'
    })
    await svc.processExtractJob(sourceId)
    await knowledgeRepo.deleteIngestJobsForSource(sourceId)
    await knowledgeRepo.updateSourceStatus(sourceId, 'ready')
    const queued = await svc.rebuildNotebookGraph(notebookId)
    expect(queued).toBe(1)
    expect((await knowledgeRepo.listIngestJobsBySource(sourceId)).map((job) => job.stage)).toEqual([
      'embed'
    ])
  })

  it('should queue graph when reprocessing after embed is done', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '已嵌入重抽' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '先嵌入再维护重抽图'
    })
    await svc.processExtractJob(sourceId)
    await svc.processEmbedJob(sourceId)
    await knowledgeRepo.deleteIngestJobsForSource(sourceId)
    await svc.reprocessSource(sourceId, 'graph')
    expect((await knowledgeRepo.listIngestJobsBySource(sourceId)).map((job) => job.stage)).toEqual([
      'graph'
    ])
    await svc.processGraphJob(sourceId)
    expect(
      graphExtractCalls.some((call) => call.sourceId === sourceId && call.force === true)
    ).toBe(true)
  })
})
