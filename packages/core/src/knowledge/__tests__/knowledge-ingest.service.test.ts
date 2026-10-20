import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { KnowledgeIngestService } from '../knowledge-ingest.service'
import { analyzePageTexts, classifyExtractQuality } from '../knowledge-extract'
import type { KnowledgeIngestContext, KnowledgeIngestRepo } from './knowledge-ingest.test-helpers'
import { describeIngest, setupKnowledgeIngest } from './knowledge-ingest.test-helpers'

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

describeIngest('KnowledgeIngestService import → retrieve', () => {
  let ctx: KnowledgeIngestContext
  let tempDir: string
  let notebooksDir: string
  let svc: KnowledgeIngestService
  let repo: KnowledgeIngestRepo

  beforeEach(async () => {
    ctx = await setupKnowledgeIngest()
    tempDir = ctx.tempDir
    notebooksDir = ctx.notebooksDir
    svc = ctx.svc
    repo = ctx.repo
  })

  afterEach(() => ctx.cleanup())

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

    const { hashEmbedSourceContent } = await import('@baishou/shared')
    const ledger = await repo.getEmbedLedger('vault_test', sourceId)
    expect(ledger?.status).toBe('embedded')
    expect(ledger?.chunkCount).toBeGreaterThan(0)
    expect(ledger?.contentHash).toBe(hashEmbedSourceContent(body))
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

  it('should keep a ready source ready when cancelling leftover graph jobs', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '取消图谱本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '已经抽出的资料'
    })
    await svc.processExtractJob(sourceId)
    await svc.processEmbedJob(sourceId)
    await knowledgeRepo.deleteIngestJobsForSource(sourceId)
    await knowledgeRepo.updateSourceStatus(sourceId, 'ready')
    await svc.reprocessSource(sourceId, 'graph')
    expect((await knowledgeRepo.getSource(sourceId))?.status).toBe('ready')
    const cancelled = await svc.cancelExtract(sourceId)
    expect(cancelled.status).toBe('ready')
    expect((await knowledgeRepo.getSource(sourceId))?.status).toBe('ready')
    expect(await knowledgeRepo.listIngestJobsBySource(sourceId)).toEqual([])
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

  it('网址导入把 originUrl 写入 sources.jsonl', async () => {
    const { id: notebookId } = await svc.createNotebook({ name: '网址本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: '文章',
      kind: 'url',
      originUrl: 'https://example.com/note',
      textContent: '# 标题\n正文',
      importProcessMode: 'later'
    })
    const jsonl = await fs.readFile(path.join(notebooksDir, notebookId, 'sources.jsonl'), 'utf8')
    expect(jsonl).toContain('"originUrl":"https://example.com/note"')
    expect((await repo.getSource(sourceId))?.originUrl).toBe('https://example.com/note')
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

  it('should tombstone the notebook record and remove its directory when deleting a notebook', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '整本删除' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'paste',
      kind: 'text',
      textContent: '整本一起删'
    })
    const source = await knowledgeRepo.getSource(sourceId)
    const sourceAbs = path.join(notebooksDir, source!.relativePath!)
    await fs.access(sourceAbs)
    await svc.deleteNotebook(notebookId)
    expect(await knowledgeRepo.getNotebook(notebookId)).toBeFalsy()
    expect(await knowledgeRepo.getSource(sourceId)).toBeFalsy()
    await expect(fs.access(path.join(notebooksDir, notebookId))).rejects.toBeTruthy()
    const jsonl = await fs.readFile(path.join(notebooksDir, 'notebooks.jsonl'), 'utf8')
    expect(jsonl).toContain(`"id":"${notebookId}"`)
    expect(jsonl).toMatch(/"deletedAt":\s*\d+/)
  })
})
