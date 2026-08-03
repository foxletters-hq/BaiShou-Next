import { splitTextIntoChunks } from '@baishou/ai'
import { logger } from '@baishou/shared'
import type { KnowledgeRepository } from '@baishou/database/shared'
import type { NotebookRawManager } from '../raw-data/managers/notebook.raw-manager'
import type { IFileSystem } from '../fs/file-system.types'
import { extractSourceContent, type ExtractResult } from './knowledge-extract'
import {
  probeExtractEngineCapabilities,
  resolveExtractEngine
} from './extract-engine-capabilities'
import { getExtractEngine, type ExtractEngineId } from './extract-engines'
import * as path from '../fs/path.util'

export interface KnowledgeIngestEmbeddingConfig {
  isConfigured: boolean
  getModelId(): string
  getProviderInstance(): Promise<{ getEmbeddingModel: (id: string) => unknown } | null>
}

export interface KnowledgeExtractConfig {
  defaultEngine?: ExtractEngineId
  ocrLanguage?: string
  ocrDpi?: number
  visionModelConfigured?: boolean
  visionModelId?: string | null
}

export interface KnowledgeIngestDeps {
  repo: KnowledgeRepository
  notebookManager: NotebookRawManager
  fs: IFileSystem
  embedding?: KnowledgeIngestEmbeddingConfig
  /** 提取引擎偏好；可每次 process 时覆盖 */
  getExtractConfig?: () => Promise<KnowledgeExtractConfig> | KnowledgeExtractConfig
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
    kind: 'file' | 'text' | 'url' | 'note'
    absolutePath?: string
    textContent?: string
    fileName?: string
    originUrl?: string
    extractEngine?: ExtractEngineId
  }): Promise<{ sourceId: string }> {
    const notebook = await this.deps.repo.getNotebook(input.notebookId)
    if (!notebook) throw new Error(`notebook not found: ${input.notebookId}`)

    const sourceId = newId(input.kind === 'note' ? 'note' : 'src')
    const now = Date.now()
    let relativePath: string | null = null
    let contentHash = ''
    let byteSize = 0
    const fileName = input.fileName || input.title
    let originUrl: string | null = input.originUrl ?? null
    const extractEngine = input.extractEngine ?? 'simple'
    const sourceKind = input.kind === 'note' ? 'note' : input.kind

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
      const safeName = `${sourceId}.${input.kind === 'note' ? 'md' : 'txt'}`
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
      sourceKind,
      relativePath,
      originUrl,
      contentHash,
      status: 'pending',
      byteSize,
      extractEngine
    })

    await this.deps.notebookManager.appendSourceRecord(input.notebookId, {
      id: sourceId,
      title: input.title,
      kind: sourceKind,
      path: relativePath
        ? relativePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
        : null,
      contentHash,
      extractEngine,
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

  /**
   * 保存 Ask 问答结论为 Note（可变合成层；v1 仅此档）。
   */
  async saveAskAsNote(input: {
    notebookId: string
    title?: string
    question: string
    answer: string
    citations?: Array<{ title: string; page?: number; excerpt?: string }>
  }): Promise<{ sourceId: string }> {
    const title =
      input.title?.trim() ||
      `问答 · ${input.question.trim().slice(0, 40)}${input.question.trim().length > 40 ? '…' : ''}`
    const citeBlock =
      input.citations?.length
        ? input.citations
            .map((c, i) => {
              const loc = c.page != null ? `第 ${c.page} 页` : ''
              return `${i + 1}. ${c.title}${loc ? `（${loc}）` : ''}${c.excerpt ? `\n   > ${c.excerpt}` : ''}`
            })
            .join('\n')
        : '（无）'
    const markdown = `# ${title}

## 问题

${input.question.trim()}

## 回答

${input.answer.trim()}

## 引用

${citeBlock}
`
    return this.importSource({
      notebookId: input.notebookId,
      title,
      kind: 'note',
      textContent: markdown
    })
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

  /**
   * 对 needs_ocr / partial 资料只 OCR 缺失页（或整份）。
   */
  async ocrMissingPages(
    sourceId: string,
    options?: {
      engine?: ExtractEngineId
      pageNumbers?: number[]
    }
  ): Promise<{ degradationMessage?: string }> {
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)
    if (source.status !== 'needs_ocr' && source.status !== 'partial' && source.status !== 'failed') {
      // 仍允许强制重跑
    }

    const engine = options?.engine ?? 'ocr'
    await this.deps.repo.updateSourceStatus(sourceId, 'pending', {
      errorMessage: null,
      extractEngine: engine
    })
    // 把意图记在 errorMessage 临时字段不合适；用 extractEngine + 下次 processExtract 读 pageNumbers
    // 简化：直接同步跑一次 OCR extract（调用方也可排 job）
    const result = await this.processExtractJob(sourceId, {
      forceEngine: engine,
      pageNumbers: options?.pageNumbers,
      onlyMissingPages: !options?.pageNumbers?.length
    })
    return { degradationMessage: result.degradationMessage }
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

  async processExtractJob(
    sourceId: string,
    override?: {
      forceEngine?: ExtractEngineId
      pageNumbers?: number[]
      onlyMissingPages?: boolean
    }
  ): Promise<ExtractResult> {
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)

    await this.deps.repo.updateSourceStatus(sourceId, 'extracting')

    const rel = source.relativePath
    if (!rel) throw new Error(`source ${sourceId} missing relativePath`)
    const abs = await this.deps.notebookManager.absolutePath(rel)
    const fileName = rel.replace(/\\/g, '/').split('/').pop() || source.title
    const ext = extOf(fileName)

    let result: ExtractResult
    let degradationMessage: string | undefined

    if (
      source.sourceKind === 'text' ||
      source.sourceKind === 'note' ||
      source.sourceKind === 'url' ||
      ext === '.md' ||
      ext === '.txt' ||
      ext === '.markdown'
    ) {
      const text = await this.deps.fs.readFile(abs, 'utf8')
      result = await extractSourceContent({
        kind:
          source.sourceKind === 'text' || source.sourceKind === 'note'
            ? 'text'
            : 'file',
        ext:
          source.sourceKind === 'text' || source.sourceKind === 'note'
            ? source.sourceKind === 'note'
              ? '.md'
              : '.txt'
            : ext,
        textContent: text
      })
    } else if (ext === '.pdf') {
      const cfg = (await this.deps.getExtractConfig?.()) ?? {}
      const requested =
        override?.forceEngine ||
        (source.extractEngine as ExtractEngineId) ||
        cfg.defaultEngine ||
        'simple'

      const caps = await probeExtractEngineCapabilities({
        visionModelConfigured: cfg.visionModelConfigured,
        visionModelId: cfg.visionModelId,
        ocrLanguage: cfg.ocrLanguage
      })
      const resolved = resolveExtractEngine(requested, caps)
      degradationMessage = resolved.message

      if (resolved.engine === 'simple') {
        result = await extractSourceContent({
          kind: 'file',
          ext: '.pdf',
          absolutePath: abs
        })
        if (degradationMessage) result.degradationMessage = degradationMessage
      } else {
        const engine = getExtractEngine(resolved.engine)
        let existingPageTexts: string[] | undefined
        if (override?.onlyMissingPages || override?.pageNumbers?.length) {
          const existing = await this.deps.notebookManager.readExtractedText(
            source.notebookId,
            sourceId
          )
          if (existing) {
            // 粗拆：按页边界表
            const pagesJson = await this.deps.notebookManager.readPagesJson(
              source.notebookId,
              sourceId
            )
            if (pagesJson?.pages?.length) {
              existingPageTexts = pagesJson.pages.map((p) =>
                existing.slice(p.start, p.end)
              )
            }
          }
        }
        const engineResult = await engine.extract({
          absolutePath: abs,
          pageNumbers: override?.pageNumbers,
          existingPageTexts,
          language: cfg.ocrLanguage,
          dpi: cfg.ocrDpi
        })
        result = {
          ...engineResult,
          degradationMessage: degradationMessage || engineResult.degradationMessage
        }
      }
      result.extractEngine = resolved.engine
    } else {
      throw new Error(`unsupported extract type: ${ext}`)
    }

    const usedEngine = result.extractEngine || 'simple'

    if (!result.text.trim() || result.quality === 'needs_ocr') {
      await this.deps.repo.updateSourceStatus(sourceId, 'needs_ocr', {
        errorMessage:
          [result.degradationMessage, result.evidence].filter(Boolean).join('；') ||
          'needs_ocr',
        pageCount: result.pageCount,
        textPageCount: result.textPageCount,
        extractEngine: usedEngine
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
      extractEngine: usedEngine,
      errorMessage:
        [result.degradationMessage, result.evidence].filter(Boolean).join('；') || null
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

    // partial：embed 后仍标 partial，提醒可继续补 OCR；否则 ready
    const pageCount = source.pageCount
    const textPageCount = source.textPageCount
    const stillPartial =
      pageCount != null &&
      textPageCount != null &&
      pageCount > 0 &&
      textPageCount / pageCount < 0.9

    await this.deps.repo.updateSourceStatus(sourceId, stillPartial ? 'partial' : 'ready', {
      errorMessage: stillPartial ? source.errorMessage : null
    })

    logger.info('[KnowledgeIngest] embed done', { sourceId, chunks: chunks.length })
  }
}
