import { it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { KnowledgeHydrationService } from '../knowledge-hydration.service'
import { md5Hex } from '../../fs/md5'
import { hashEmbedSourceContent } from '@baishou/shared'
import type { KnowledgeHydrationContext } from './knowledge-hydration.test-helpers'
import { describeHydration, setupKnowledgeHydration } from './knowledge-hydration.test-helpers'

describeHydration('KnowledgeHydrationService', () => {
  let notebooksDir: string
  let repo: KnowledgeHydrationContext['repo']
  let notebookManager: KnowledgeHydrationContext['notebookManager']
  let ctx: KnowledgeHydrationContext

  beforeEach(async () => {
    ctx = await setupKnowledgeHydration()
    notebooksDir = ctx.notebooksDir
    repo = ctx.repo
    notebookManager = ctx.notebookManager
  })

  afterEach(() => {
    ctx?.cleanup()
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
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => false
    })
    const skipResult = await skipped.hydrate()
    expect(skipResult.sourcesUpserted).toBe(1)
    expect(skipResult.embedJobsEnqueued).toBe(0)
    expect(skipResult.skipped).toBe('embedding-not-configured')

    const withEmbed = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => true
    })
    const result = await withEmbed.hydrate()
    expect(result.embedJobsEnqueued).toBe(1)
    expect(result.graphJobsEnqueued).toBe(0)
    const jobs = await repo.listIngestJobs()
    expect(jobs.some((j) => j.sourceId === 'src1' && j.stage === 'embed')).toBe(true)
    expect(jobs.some((j) => j.sourceId === 'src1' && j.stage === 'graph')).toBe(false)

    // 模拟已嵌入：写入 chunk 后再次 hydrate 不应重复排 embed；无 extract-state 仍排 graph
    await repo.insertChunk({
      chunkId: 'src1_0',
      notebookId: 'nb1',
      sourceId: 'src1',
      chunkIndex: 0,
      chunkText: text,
      embedding: Buffer.from(new Float32Array(4).buffer),
      dimension: 4,
      modelId: 'mock',
      vaultId: 'vault_test'
    })
    await repo.updateSourceStatus('src1', 'ready', { extractedTextHash: md5Hex(text) })
    await repo.recordEmbedded({
      vaultId: 'vault_test',
      sourceId: 'src1',
      contentHash: hashEmbedSourceContent(text),
      chunkCount: 1,
      modelId: 'mock',
      dimension: 4
    })
    for (const job of jobs) {
      await repo.completeIngestJob(job.id)
    }

    const again = await withEmbed.hydrate()
    expect(again.embedJobsEnqueued).toBe(0)
    expect(again.graphJobsEnqueued).toBe(1)
  })

  it('embedMissing false 只灌结构不入队 embed/graph', async () => {
    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb_noauto',
      name: '不同步嵌',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await notebookManager.appendSourceRecord('nb_noauto', {
      id: 'src_noauto',
      title: '笔记',
      kind: 'text',
      path: 'sources/src_noauto.txt',
      contentHash: 'abc',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await notebookManager.writeExtracted('nb_noauto', 'src_noauto', '同步后不要自动嵌入')

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => true
    })
    const result = await svc.hydrate({ embedMissing: false })
    expect(result.sourcesUpserted).toBe(1)
    expect(result.embedJobsEnqueued).toBe(0)
    expect(result.graphJobsEnqueued).toBe(0)
    const jobs = await repo.listIngestJobs()
    expect(jobs.some((j) => j.sourceId === 'src_noauto')).toBe(false)
  })

  it('半成品 chunk 不得标 ready', async () => {
    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb_half',
      name: '半成品',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await notebookManager.appendSourceRecord('nb_half', {
      id: 'src_half',
      title: '半成品',
      kind: 'text',
      path: 'sources/src_half.txt',
      contentHash: 'h',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    const text = '嵌入中途崩溃的半成品'
    await notebookManager.writeExtracted('nb_half', 'src_half', text)
    await repo.createNotebook({ id: 'nb_half', name: '半成品', vaultId: 'vault_test' })
    await repo.upsertSource({
      id: 'src_half',
      notebookId: 'nb_half',
      title: '半成品',
      sourceKind: 'text',
      contentHash: 'h',
      extractedTextHash: md5Hex(text),
      status: 'pending',
      vaultId: 'vault_test'
    })
    await repo.insertChunk({
      chunkId: 'src_half_0',
      notebookId: 'nb_half',
      sourceId: 'src_half',
      chunkIndex: 0,
      chunkText: text,
      embedding: Buffer.from(new Float32Array(2).buffer),
      dimension: 2,
      modelId: 'mock',
      vaultId: 'vault_test'
    })

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => true
    })
    await svc.hydrate()
    const row = await repo.getSource('src_half')
    expect(row?.status).not.toBe('ready')
    expect(row?.status).toBe('pending')
  })

  it('orphan 清理：磁盘已删的 source 从库移除', async () => {
    await repo.createNotebook({ id: 'nb1', name: '研究', vaultId: 'vault_test' })
    await repo.upsertSource({
      id: 'orphan',
      notebookId: 'nb1',
      title: '幽灵',
      sourceKind: 'text',
      contentHash: 'x',
      status: 'ready',
      vaultId: 'vault_test'
    })
    await repo.insertChunk({
      chunkId: 'orphan_0',
      notebookId: 'nb1',
      sourceId: 'orphan',
      chunkIndex: 0,
      chunkText: 'gone',
      embedding: Buffer.from(new Float32Array(2).buffer),
      dimension: 2,
      modelId: 'mock',
      vaultId: 'vault_test'
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
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => true
    })
    const result = await svc.hydrate()
    expect(result.orphansCleaned).toBeGreaterThanOrEqual(1)
    expect(await repo.getSource('orphan')).toBeNull()
    expect(await repo.listChunksBySource('orphan')).toEqual([])
  })

  it('删除最后一个笔记本时按 notebooks.jsonl tombstone 清理 DB', async () => {
    const now = Date.now()
    await repo.createNotebook({ id: 'nb_last', name: '最后一本', vaultId: 'vault_test' })
    await repo.upsertSource({
      id: 'src_last',
      notebookId: 'nb_last',
      title: '最后一本资料',
      sourceKind: 'text',
      contentHash: 'x',
      status: 'ready',
      vaultId: 'vault_test'
    })
    await notebookManager.appendNotebookRecord({
      id: 'nb_last',
      name: '最后一本',
      createdAt: now,
      updatedAt: now,
      deletedAt: now
    })

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => false
    })
    const result = await svc.hydrate()
    expect(result.orphansCleaned).toBeGreaterThanOrEqual(1)
    expect(await repo.getNotebook('nb_last')).toBeNull()
    expect(await repo.getSource('src_last')).toBeNull()
  })

  it('notebooks.jsonl 不存在时不清理空 vault', async () => {
    await repo.createNotebook({ id: 'nb_keep', name: '保留', vaultId: 'vault_test' })
    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => false
    })
    const result = await svc.hydrate()
    expect(result.orphansCleaned).toBe(0)
    expect(await repo.getNotebook('nb_keep')).not.toBeNull()
  })

  it('水合时把 sources.jsonl 的 originUrl 写回资料行', async () => {
    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb_url',
      name: '网址',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await notebookManager.appendSourceRecord('nb_url', {
      id: 'src_url',
      title: '外链',
      kind: 'url',
      path: 'sources/src_url.md',
      originUrl: 'https://example.com/a',
      contentHash: 'hash-url',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => false
    })
    await svc.hydrate()
    const row = await repo.getSource('src_url')
    expect(row?.originUrl).toBe('https://example.com/a')
  })

  it('JSONL 无 pageCount 时不得清空库内页数', async () => {
    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb_pc',
      name: '页数',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await notebookManager.appendSourceRecord('nb_pc', {
      id: 'src_pc',
      title: '扫描件',
      kind: 'file',
      path: 'sources/src_pc.pdf',
      contentHash: 'pdf',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await repo.createNotebook({ id: 'nb_pc', name: '页数', vaultId: 'vault_test' })
    await repo.upsertSource({
      id: 'src_pc',
      notebookId: 'nb_pc',
      title: '扫描件',
      sourceKind: 'file',
      contentHash: 'pdf',
      status: 'needs_ocr',
      pageCount: 5,
      vaultId: 'vault_test'
    })

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => false
    })
    await svc.hydrate()
    const row = await repo.getSource('src_pc')
    expect(row?.pageCount).toBe(5)
  })

  it('水合时写入封面色与排序；旧记录缺字段不覆盖库内值', async () => {
    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb_look',
      name: '外观',
      createdAt: now,
      updatedAt: now,
      sortOrder: 3,
      coverTone: 'rose',
      coverIcon: '🪐',
      coverImage: 'nb_look/cover.png',
      deletedAt: null
    })

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => false
    })
    await svc.hydrate()
    const created = await repo.getNotebook('nb_look')
    expect(created?.sortOrder).toBe(3)
    expect(created?.coverTone).toBe('rose')
    expect(created?.coverIcon).toBe('🪐')
    expect(created?.coverImage).toBe('nb_look/cover.png')

    await notebookManager.appendNotebookRecord({
      id: 'nb_look',
      name: '外观改名',
      createdAt: now,
      updatedAt: now + 10,
      deletedAt: null
    })
    await svc.hydrate()
    const kept = await repo.getNotebook('nb_look')
    expect(kept?.name).toBe('外观改名')
    expect(kept?.sortOrder).toBe(3)
    expect(kept?.coverTone).toBe('rose')
    expect(kept?.coverIcon).toBe('🪐')
    expect(kept?.coverImage).toBe('nb_look/cover.png')
  })

  it('JSONL 缺封面字段时从磁盘 cover.* 回填', async () => {
    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb_cover',
      name: '有图',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    const coverAbs = path.join(notebooksDir, 'nb_cover', 'cover.webp')
    await fs.mkdir(path.dirname(coverAbs), { recursive: true })
    await fs.writeFile(coverAbs, Buffer.from([0x52, 0x49, 0x46, 0x46]))

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => false
    })
    await svc.hydrate()
    expect((await repo.getNotebook('nb_cover'))?.coverImage).toBe('nb_cover/cover.webp')
  })

  it('切仓水合不得删他仓 notebook/source', async () => {
    await repo.createNotebook({ id: 'nb_other', name: '他仓', vaultId: 'vault_other' })
    await repo.upsertSource({
      id: 'src_other',
      notebookId: 'nb_other',
      title: '他仓资料',
      sourceKind: 'text',
      contentHash: 'y',
      status: 'ready',
      vaultId: 'vault_other'
    })

    const now = Date.now()
    await notebookManager.appendNotebookRecord({
      id: 'nb_cur',
      name: '本仓',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })

    const svc = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId: 'vault_cur',
      isEmbeddingConfigured: () => true
    })
    const result = await svc.hydrate()
    expect(result.orphansCleaned).toBe(0)
    expect(await repo.getNotebook('nb_other')).not.toBeNull()
    expect(await repo.getSource('src_other')).not.toBeNull()
  })
})
