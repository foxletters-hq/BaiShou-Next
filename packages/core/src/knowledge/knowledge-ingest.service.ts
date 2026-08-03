import { splitTextIntoChunks } from '@baishou/ai'
import { logger } from '@baishou/shared'
import type { KnowledgeRepository } from '@baishou/database/shared'
import type { NotebookRawManager } from '../raw-data/managers/notebook.raw-manager'
import type { IFileSystem } from '../fs/file-system.types'
import { extractSourceContent, type ExtractResult } from './knowledge-extract'
import * as path from '../fs/path.util'

export interface KnowledgeIngestEmbeddingConfig {
  isConfigured: boolean
  getModelId(): string
  getProviderInstance(): Promise<{ getEmbeddingModel: (id: string) => unknown } | null>
}

export interface KnowledgeIngestDeps {
  repo: KnowledgeRepository
  notebookManager: NotebookRawManager
  fs: IFileSystem
  embedding?: KnowledgeIngestEmbeddingConfig
  insertChunk: (params: {
    chunkId: string
    notebookId: string
    sourceId: string
    chunkIndex: number
    chunkText: string
    metadataJson?: string
    embedding: number[]
    modelId: string
  }) => Promise<void>
  deleteChunksBySource: (sourceId: string) => Promise<void>
  /** 可选：真实网络嵌入；缺省时用 insertChunk 传入的向量由调用方 mock */
  embedText?: (text: string, modelId: string) => Promise<number[]>
}

function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${rand}`
}

function extOf(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i >= 0 ? fileName.slice(i).toLowerCase() : ''
}

function byteLengthUtf8(text: string): number {
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(text, 'utf8')
  return new TextEncoder().encode(text).length
}

/**
 * 知识库摄入编排：extract → embed 两段 job；磁盘先落定再灌库。
 */
export class KnowledgeIngestService {
  constructor(private readonly deps: KnowledgeIngestDeps) {}

  async createNotebook(input: {
    name: string
    description?: string
    id?: string
  }): Promise<{ id: string; name: string }> {
    const id = input.id ?? newId('nb')
    const now = Date.now()
    await this.deps.repo.createNotebook({
      id,
      name: input.name,
      description: input.description
    })
    await this.deps.notebookManager.appendNotebookRecord({
      id,
      name: input.name,
      description: input.description ?? '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    return { id, name: input.name }
  }

  async listNotebooks() {
    return this.deps.repo.listNotebooks()
  }

  async importSource(input: {
    notebookId: string
    title: string
    kind: 'file' | 'text' | 'url'
    absolutePath?: string
    textContent?: string
    fileName?: string
    originUrl?: string
  }): Promise<{ sourceId: string }> {
    const notebook = await this.deps.repo.getNotebook(input.notebookId)
    if (!notebook) throw new Error(`notebook not found: ${input.notebookId}`)

    const sourceId = newId('src')
    const now = Date.now()
    let relativePath: string | null = null
    let contentHash = ''
    let byteSize = 0
    const fileName = input.fileName || input.title
    let originUrl: string | null = input.originUrl ?? null

    if (input.kind === 'file') {
      if (!input.absolutePath) throw new Error('import file requires absolutePath')
      const safeName = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      relativePath = path.join(input.notebookId, 'sources', safeName)
      const written = await this.deps.notebookManager.copySourceFile(
        relativePath,
        input.absolutePath
      )
      contentHash = written.contentHash
      try {
        const abs = await this.deps.notebookManager.absolutePath(relativePath)
        const st = await this.deps.fs.stat(abs)
        byteSize = st.size ?? 0
      } catch {
        byteSize = 0
      }
    } else if (input.kind === 'url') {
      const text = input.textContent ?? ''
      if (!text.trim()) throw new Error('import url requires textContent')
      if (!originUrl?.trim()) throw new Error('import url requires originUrl')
      originUrl = originUrl.trim()
      const safeName = `${sourceId}.md`
      relativePath = path.join(input.notebookId, 'sources', safeName)
      const written = await this.deps.notebookManager.writeFile(relativePath, text, {
        skipVersion: true
      })
      contentHash = written.contentHash
      byteSize = byteLengthUtf8(text)
    } else {
      const text = input.textContent ?? ''
      const safeName = `${sourceId}.txt`
      relativePath = path.join(input.notebookId, 'sources', safeName)
      const written = await this.deps.notebookManager.writeFile(relativePath, text, {
        skipVersion: true
      })
      contentHash = written.contentHash
      byteSize = byteLengthUtf8(text)
    }

    await this.deps.repo.upsertSource({
      id: sourceId,
      notebookId: input.notebookId,
      title: input.title,
      sourceKind: input.kind,
      relativePath,
      originUrl,
      contentHash,
      status: 'pending',
      byteSize,
      extractEngine: 'simple'
    })

    await this.deps.notebookManager.appendSourceRecord(input.notebookId, {
      id: sourceId,
      title: input.title,
      kind: input.kind,
      path: relativePath
        ? relativePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
        : null,
      contentHash,
      extractEngine: 'simple',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })

    await this.deps.repo.enqueueIngestJob({
      notebookId: input.notebookId,
      sourceId,
      stage: 'extract'
    })

    return { sourceId }
  }

  async retrySource(sourceId: string): Promise<void> {
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)
    const stage =
      source.status === 'failed' && source.extractedTextHash ? 'embed' : 'extract'
    await this.deps.repo.updateSourceStatus(sourceId, 'pending', { errorMessage: null })
    await this.deps.repo.enqueueIngestJob({
      notebookId: source.notebookId,
      sourceId,
      stage
    })
  }

  async rebuildIndex(notebookId: string): Promise<void> {
    const sources = await this.deps.repo.listSources(notebookId)
    await this.deps.repo.deleteChunksByNotebook(notebookId)
    for (const source of sources) {
      if (!source.extractedTextHash && source.status === 'needs_ocr') continue
      await this.deps.repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
      await this.deps.repo.enqueueIngestJob({
        notebookId,
        sourceId: source.id,
        stage: 'embed'
      })
    }
  }

  async processExtractJob(sourceId: string): Promise<ExtractResult> {
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)

    await this.deps.repo.updateSourceStatus(sourceId, 'extracting')

    const rel = source.relativePath
    if (!rel) throw new Error(`source ${sourceId} missing relativePath`)
    const abs = await this.deps.notebookManager.absolutePath(rel)
    const fileName = rel.replace(/\\/g, '/').split('/').pop() || source.title
    const ext = extOf(fileName)

    let result: ExtractResult

    if (source.sourceKind === 'text' || ext === '.md' || ext === '.txt' || ext === '.markdown') {
      const text = await this.deps.fs.readFile(abs, 'utf8')
      result = await extractSourceContent({
        kind: source.sourceKind === 'text' ? 'text' : 'file',
        ext: source.sourceKind === 'text' ? '.txt' : ext,
        textContent: text
      })
    } else if (ext === '.pdf') {
      result = await extractSourceContent({
        kind: 'file',
        ext: '.pdf',
        absolutePath: abs
      })
    } else {
      throw new Error(`unsupported extract type: ${ext}`)
    }

    if (!result.text.trim() || result.quality === 'needs_ocr') {
      await this.deps.repo.updateSourceStatus(sourceId, 'needs_ocr', {
        errorMessage: result.evidence ?? 'needs_ocr',
        pageCount: result.pageCount,
        textPageCount: result.textPageCount,
        extractEngine: 'simple'
      })
      if (result.text.trim()) {
        await this.deps.notebookManager.writeExtracted(
          source.notebookId,
          sourceId,
          result.text,
          result.pages
        )
      }
      return result
    }

    const { textHash } = await this.deps.notebookManager.writeExtracted(
      source.notebookId,
      sourceId,
      result.text,
      result.pages
    )

    const nextStatus = result.quality === 'partial' ? 'partial' : 'embedding'
    await this.deps.repo.updateSourceStatus(sourceId, nextStatus, {
      extractedTextHash: textHash,
      pageCount: result.pageCount,
      textPageCount: result.textPageCount,
      extractEngine: 'simple',
      errorMessage: result.evidence ?? null
    })

    await this.deps.repo.enqueueIngestJob({
      notebookId: source.notebookId,
      sourceId,
      stage: 'embed'
    })

    return result
  }

  async processEmbedJob(sourceId: string): Promise<void> {
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)

    const text = await this.deps.notebookManager.readExtractedText(source.notebookId, sourceId)
    if (!text?.trim()) {
      await this.deps.repo.updateSourceStatus(sourceId, 'failed', {
        errorMessage: 'extracted text missing'
      })
      throw new Error('extracted text missing')
    }

    const embeddingCfg = this.deps.embedding
    if (!embeddingCfg?.isConfigured && !this.deps.embedText) {
      throw new Error('embedding-not-configured')
    }

    await this.deps.repo.updateSourceStatus(sourceId, 'embedding')
    await this.deps.deleteChunksBySource(sourceId)

    const modelId = embeddingCfg?.getModelId() ?? 'mock'
    const chunks = splitTextIntoChunks(text)
    let charCursor = 0

    for (const chunk of chunks) {
      let vector: number[]
      if (this.deps.embedText) {
        vector = await this.deps.embedText(chunk.text, modelId)
      } else {
        const provider = await embeddingCfg!.getProviderInstance()
        if (!provider) throw new Error('embedding provider unavailable')
        const { embed } = await import('ai')
        const aiModel = provider.getEmbeddingModel(modelId) as never
        const { embedding } = await embed({ model: aiModel, value: chunk.text })
        vector = Array.from(embedding)
      }

      const offset = text.indexOf(chunk.text, charCursor)
      const resolvedOffset = offset >= 0 ? offset : charCursor
      charCursor = resolvedOffset + chunk.text.length

      await this.deps.insertChunk({
        chunkId: `${sourceId}_${chunk.index}`,
        notebookId: source.notebookId,
        sourceId,
        chunkIndex: chunk.index,
        chunkText: chunk.text,
        metadataJson: JSON.stringify({
          offset: resolvedOffset,
          len: chunk.text.length,
          chunker: 'tiktoken-1024-128'
        }),
        embedding: vector,
        modelId
      })
    }

    await this.deps.repo.updateSourceStatus(sourceId, 'ready', { errorMessage: null })
    logger.info('[KnowledgeIngest] embed done', { sourceId, chunks: chunks.length })
  }
}
