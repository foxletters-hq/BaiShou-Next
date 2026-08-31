import { splitTextIntoChunks } from '@baishou/ai'
import {
  knowledgeImportProcessTargets,
  logger,
  normalizeKnowledgeImportProcessMode,
  normalizeNotebookCoverIcon,
  normalizeNotebookCoverImage,
  normalizeNotebookCoverTone,
  notebookCoverImageExt
} from '@baishou/shared'
import type { KnowledgeImportProcessMode } from '@baishou/shared'
import type { KnowledgeRepository } from '@baishou/database/shared'
import type {
  NotebookRawManager,
  NotebookRawRecord
} from '../raw-data/managers/notebook.raw-manager'
import type { IFileSystem } from '../fs/file-system.types'
import { extractSourceContent, type ExtractResult } from './knowledge-extract'
import { probeExtractEngineCapabilities, resolveExtractEngine } from './extract-engine-capabilities'
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
  /** OCR / vision 并发页数（1–10） */
  ocrConcurrency?: number
  visionModelConfigured?: boolean
  visionModelId?: string | null
}

export interface KnowledgeExtractProgress {
  sourceId: string
  page: number
  total: number
  phase?: 'ocr' | 'vision' | 'render'
}

export interface KnowledgeIngestDeps {
  repo: KnowledgeRepository
  notebookManager: NotebookRawManager
  fs: IFileSystem
  /** 当前活跃仓库 id；写入 knowledge.db 时必填 */
  getVaultId: () => string
  embedding?: KnowledgeIngestEmbeddingConfig
  /** 提取引擎偏好；可每次 process 时覆盖 */
  getExtractConfig?: () => Promise<KnowledgeExtractConfig> | KnowledgeExtractConfig
  /** OCR / vision 逐页进度（可选） */
  onExtractProgress?: (info: KnowledgeExtractProgress) => void
  insertChunk: (params: {
    chunkId: string
    notebookId: string
    sourceId: string
    chunkIndex: number
    chunkText: string
    metadataJson?: string
    embedding: number[]
    modelId: string
    vaultId: string
  }) => Promise<void>
  deleteChunksBySource: (sourceId: string) => Promise<void>
  /** 可选：真实网络嵌入；缺省时用 insertChunk 传入的向量由调用方 mock */
  embedText?: (text: string, modelId: string) => Promise<number[]>
  extractNotebookGraph?: (input: {
    vaultId: string
    notebookId: string
    sourceId: string
    sourceTitle: string
    text: string
    textHash: string
    pages?: Array<{ page: number; start: number; end: number }> | null
    force?: boolean
  }) => Promise<void>
  deleteNotebookGraphSource?: (input: { notebookId: string; sourceId: string }) => Promise<void>
}

/** 入队 OCR 时暂存的页码覆盖（consumer 无 payload 时用） */
const pendingExtractOverrides = new Map<
  string,
  { pageNumbers?: number[]; onlyMissingPages?: boolean; forceEngine?: ExtractEngineId }
>()

/** 用户点重新抽取图数据时，消费端另建 service 实例，用模块级标记跨实例传 force */
const pendingGraphExtractForce = new Set<string>()

function markGraphExtractForce(sourceId: string): void {
  const id = sourceId.trim()
  if (id) pendingGraphExtractForce.add(id)
}

function peekGraphExtractForce(sourceId: string): boolean {
  return pendingGraphExtractForce.has(sourceId.trim())
}

function clearGraphExtractForce(sourceId: string): void {
  pendingGraphExtractForce.delete(sourceId.trim())
}

/** 导入时指定提取完成后入队哪些后续任务；缺省两边都做 */
const pendingProcessTargets = new Map<string, { embed: boolean; graph: boolean }>()

function rememberProcessTargets(
  sourceId: string,
  targets: { embed: boolean; graph: boolean }
): void {
  pendingProcessTargets.set(sourceId, targets)
}

function takeProcessTargets(sourceId: string): { embed: boolean; graph: boolean } {
  const remembered = pendingProcessTargets.get(sourceId)
  pendingProcessTargets.delete(sourceId)
  return remembered ?? { embed: true, graph: true }
}

/** 进行中的提取取消控制器 */
const extractAbortControllers = new Map<string, AbortController>()

/**
 * claim 之后、AbortController 注册之前的保护窗。
 * recoverStale 不得清掉这些 source，否则会与正在启动的 extract 竞态。
 */
const extractLiveGuards = new Set<string>()
const embedLiveGuards = new Set<string>()
const graphLiveGuards = new Set<string>()

/** consumer claim 到 extract job 后立刻调用；process 结束在 finally 中解除 */
export function markExtractJobLive(sourceId: string): void {
  extractLiveGuards.add(sourceId)
}

export function unmarkExtractJobLive(sourceId: string): void {
  extractLiveGuards.delete(sourceId)
}

export function markEmbedJobLive(sourceId: string): void {
  embedLiveGuards.add(sourceId)
}

export function unmarkEmbedJobLive(sourceId: string): void {
  embedLiveGuards.delete(sourceId)
}

export function markGraphJobLive(sourceId: string): void {
  graphLiveGuards.add(sourceId)
}

export function unmarkGraphJobLive(sourceId: string): void {
  graphLiveGuards.delete(sourceId)
}

export function listLiveGraphSourceIds(): string[] {
  return [...graphLiveGuards]
}

function isExtractProtected(sourceId: string): boolean {
  return (
    extractAbortControllers.has(sourceId) ||
    extractLiveGuards.has(sourceId) ||
    pendingExtractOverrides.has(sourceId)
  )
}

function endExtractAbort(sourceId: string, controller?: AbortController): void {
  const cur = extractAbortControllers.get(sourceId)
  if (!controller || cur === controller) {
    extractAbortControllers.delete(sourceId)
  }
}

function requestExtractAbort(sourceId: string): void {
  pendingExtractOverrides.delete(sourceId)
  const cur = extractAbortControllers.get(sourceId)
  if (cur) cur.abort()
}

function isExtractCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('knowledge-extract-cancelled')
}

function throwIfExtractAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('knowledge-extract-cancelled')
}

async function revertIfExtractAborted(
  repo: KnowledgeRepository,
  sourceId: string,
  signal?: AbortSignal
): Promise<void> {
  if (!signal?.aborted) return
  const latest = await repo.getSource(sourceId)
  if (latest) {
    const status = resolveStatusAfterCancel(latest)
    await repo.updateSourceStatus(sourceId, status, {
      errorMessage: status === 'failed' ? 'cancelled' : null
    })
  }
  await repo.deleteIngestJobsForSource(sourceId)
  throw new Error('knowledge-extract-cancelled')
}

function resolveStatusAfterCancel(source: {
  extractedTextHash?: string | null
  pageCount?: number | null
  textPageCount?: number | null
  extractEngine?: string | null
}): 'needs_ocr' | 'partial' | 'failed' {
  if (
    source.extractedTextHash &&
    source.pageCount != null &&
    source.textPageCount != null &&
    source.textPageCount > 0 &&
    source.textPageCount < source.pageCount
  ) {
    return 'partial'
  }
  if (source.extractedTextHash && (source.textPageCount ?? 0) > 0) {
    return 'partial'
  }
  const engine = source.extractEngine
  if (engine === 'ocr' || engine === 'vision') {
    return 'needs_ocr'
  }
  // 曾探测到页数但尚无文本：更像 OCR 欠账，而不是普通导入取消
  if (source.pageCount != null && source.pageCount > 0 && (source.textPageCount ?? 0) === 0) {
    return 'needs_ocr'
  }
  return 'failed'
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

function requireVaultId(getVaultId: () => string): string {
  const id = getVaultId()?.trim() || ''
  if (!id) throw new Error('vaultId is required for knowledge ingest')
  return id
}

function toNotebookRawRecord(row: {
  id: string
  name: string
  description?: string | null
  createdAt: number
  updatedAt: number
  sortOrder?: number
  coverTone?: string | null
  coverIcon?: string | null
  coverImage?: string | null
}): NotebookRawRecord {
  const coverTone = normalizeNotebookCoverTone(row.coverTone)
  const coverIcon = normalizeNotebookCoverIcon(row.coverIcon)
  const coverImage = normalizeNotebookCoverImage(row.id, row.coverImage)
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: null,
    sortOrder: row.sortOrder ?? 0,
    ...(coverTone ? { coverTone } : {}),
    ...(coverIcon ? { coverIcon } : {}),
    ...(coverImage ? { coverImage } : {})
  }
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
    coverTone?: string
    coverIcon?: string
  }): Promise<{
    id: string
    name: string
    coverTone: string
    coverIcon: string
    sortOrder: number
  }> {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const id = input.id ?? newId('nb')
    const existing = await this.deps.repo.listNotebooks({ vaultId })
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder ?? 0), -1) + 1
    const coverTone = normalizeNotebookCoverTone(input.coverTone)
    const coverIcon = normalizeNotebookCoverIcon(input.coverIcon)
    const created = await this.deps.repo.createNotebook({
      id,
      name: input.name,
      description: input.description,
      vaultId,
      sortOrder,
      coverTone,
      coverIcon
    })
    await this.deps.notebookManager.appendNotebookRecord(toNotebookRawRecord(created))
    return {
      id,
      name: created.name,
      coverTone: created.coverTone,
      coverIcon: created.coverIcon,
      sortOrder: created.sortOrder
    }
  }

  async listNotebooks() {
    const vaultId = requireVaultId(this.deps.getVaultId)
    return this.deps.repo.listNotebooks({ vaultId })
  }

  async updateNotebook(input: {
    notebookId: string
    name?: string
    description?: string
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }) {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const existing = await this.deps.repo.getNotebook(input.notebookId)
    if (!existing || existing.vaultId !== vaultId) {
      throw new Error('notebook not found')
    }
    const patch: {
      name?: string
      description?: string
      coverTone?: string
      coverIcon?: string
      coverImage?: string
    } = {}
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) throw new Error('notebook name is required')
      patch.name = name
    }
    if (input.description !== undefined) patch.description = input.description
    if (input.coverTone !== undefined) {
      patch.coverTone = normalizeNotebookCoverTone(input.coverTone)
    }
    if (input.coverIcon !== undefined) {
      patch.coverIcon = normalizeNotebookCoverIcon(input.coverIcon)
    }
    if (input.coverImage !== undefined) {
      patch.coverImage = normalizeNotebookCoverImage(existing.id, input.coverImage)
      if (!patch.coverImage && existing.coverImage) {
        await this.removeCoverImageFile(existing.coverImage)
      }
    }
    if (Object.keys(patch).length === 0) return existing
    await this.deps.repo.updateNotebook(existing.id, patch)
    const updated = await this.deps.repo.getNotebook(existing.id)
    if (!updated) throw new Error('notebook missing after update')
    await this.deps.notebookManager.appendNotebookRecord(toNotebookRawRecord(updated))
    return updated
  }

  async setCoverImage(input: { notebookId: string; absolutePath: string }) {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const existing = await this.deps.repo.getNotebook(input.notebookId)
    if (!existing || existing.vaultId !== vaultId) {
      throw new Error('notebook not found')
    }
    const ext = notebookCoverImageExt(input.absolutePath)
    if (!ext) throw new Error('cover image must be png, jpg, jpeg, webp or gif')
    const relativePath = normalizeNotebookCoverImage(existing.id, `${existing.id}/cover.${ext}`)
    if (!relativePath) throw new Error('invalid cover image path')
    if (existing.coverImage && existing.coverImage !== relativePath) {
      await this.removeCoverImageFile(existing.coverImage)
    }
    await this.deps.notebookManager.copySourceFile(relativePath, input.absolutePath)
    await this.deps.repo.updateNotebook(existing.id, { coverImage: relativePath })
    const updated = await this.deps.repo.getNotebook(existing.id)
    if (!updated) throw new Error('notebook missing after update')
    await this.deps.notebookManager.appendNotebookRecord(toNotebookRawRecord(updated))
    return updated
  }

  private async removeCoverImageFile(relativePath: string): Promise<void> {
    try {
      const abs = await this.deps.notebookManager.absolutePath(relativePath)
      if (await this.deps.fs.exists(abs)) await this.deps.fs.unlink(abs)
    } catch {
      /* 旧封面不在盘上时忽略 */
    }
  }

  async reorderNotebooks(orderedIds: string[]) {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const existing = await this.deps.repo.listNotebooks({ vaultId })
    const byId = new Map(existing.map((row) => [row.id, row]))
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const id of orderedIds) {
      if (!byId.has(id) || seen.has(id)) continue
      seen.add(id)
      ordered.push(id)
    }
    for (const row of existing) {
      if (!seen.has(row.id)) ordered.push(row.id)
    }
    const now = Date.now()
    for (let i = 0; i < ordered.length; i++) {
      const row = byId.get(ordered[i]!)
      if (!row) continue
      await this.deps.repo.updateNotebook(row.id, { sortOrder: i })
      await this.deps.notebookManager.appendNotebookRecord(
        toNotebookRawRecord({
          ...row,
          sortOrder: i,
          updatedAt: now
        })
      )
    }
    return this.deps.repo.listNotebooks({ vaultId })
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
    /** 导入后处理：向量、图关系，或两者。 */
    importProcessMode?: KnowledgeImportProcessMode
  }): Promise<{ sourceId: string }> {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const notebook = await this.deps.repo.getNotebook(input.notebookId)
    if (!notebook) throw new Error(`notebook not found: ${input.notebookId}`)
    if (notebook.vaultId && notebook.vaultId !== vaultId) {
      throw new Error(`notebook belongs to another vault: ${input.notebookId}`)
    }

    const sourceId = newId(input.kind === 'note' ? 'note' : 'src')
    const now = Date.now()
    let relativePath: string | null = null
    let contentHash = ''
    let byteSize = 0
    const fileName = input.fileName || input.title
    let originUrl: string | null = input.originUrl ?? null
    const extractEngine = input.extractEngine ?? 'simple'
    const sourceKind = input.kind === 'note' ? 'note' : input.kind
    const importProcessMode = normalizeKnowledgeImportProcessMode(input.importProcessMode)
    const processTargets = knowledgeImportProcessTargets(importProcessMode)

    if (input.kind === 'file') {
      if (!input.absolutePath) throw new Error('import file requires absolutePath')
      const safeName = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      // 同名文件不覆盖：sources/${sourceId}_${safeName}
      relativePath = path.join(input.notebookId, 'sources', `${sourceId}_${safeName}`)
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
      vaultId,
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
      path: relativePath ? relativePath.replace(/\\/g, '/').split('/').slice(-2).join('/') : null,
      contentHash,
      extractEngine,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })

    rememberProcessTargets(sourceId, {
      embed: processTargets.embed,
      graph: processTargets.graph
    })
    await this.deps.repo.enqueueIngestJob({
      notebookId: input.notebookId,
      sourceId,
      stage: 'extract',
      vaultId
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
    const citeBlock = input.citations?.length
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

  async deleteSource(sourceId: string): Promise<void> {
    requestExtractAbort(sourceId)
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)
    const now = Date.now()

    const unlinkRel = async (relativePath: string | null | undefined) => {
      if (!relativePath) return
      try {
        const abs = await this.deps.notebookManager.absolutePath(relativePath)
        if (await this.deps.fs.exists(abs)) await this.deps.fs.unlink(abs)
      } catch {
        /* 文件缺失不拦删除 */
      }
    }

    await unlinkRel(source.relativePath)
    await unlinkRel(path.join(source.notebookId, 'extracted', `${sourceId}.md`))
    await unlinkRel(path.join(source.notebookId, 'extracted', `${sourceId}.pages.json`))

    await this.deps.notebookManager.appendSourceRecord(source.notebookId, {
      id: source.id,
      title: source.title,
      kind: source.sourceKind,
      path: source.relativePath
        ? source.relativePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
        : null,
      contentHash: source.contentHash,
      extractEngine: source.extractEngine,
      pageCount: source.pageCount,
      createdAt: source.createdAt,
      updatedAt: now,
      deletedAt: now
    })

    if (this.deps.deleteNotebookGraphSource) {
      try {
        await this.deps.deleteNotebookGraphSource({
          notebookId: source.notebookId,
          sourceId
        })
      } catch {
        /* 图谱分片缺失不拦删除 */
      }
    }

    await this.deps.repo.deleteSource(sourceId)
  }

  async retrySource(sourceId: string): Promise<void> {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)
    const stage = source.extractedTextHash ? 'embed' : 'extract'
    await this.deps.repo.updateSourceStatus(sourceId, 'pending', { errorMessage: null })
    await this.deps.repo.enqueueIngestJob({
      notebookId: source.notebookId,
      sourceId,
      stage,
      vaultId: source.vaultId?.trim() || vaultId
    })
    if (source.extractedTextHash) {
      await this.deps.repo.enqueueIngestJob({
        notebookId: source.notebookId,
        sourceId,
        stage: 'graph',
        vaultId: source.vaultId?.trim() || vaultId
      })
    }
  }

  async reprocessSource(sourceId: string, target: 'embed' | 'graph'): Promise<void> {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)
    if (!source.extractedTextHash) {
      throw new Error('extracted text missing')
    }
    if (target === 'embed') {
      await this.deps.repo.updateSourceStatus(sourceId, 'pending', { errorMessage: null })
      await this.deps.repo.enqueueIngestJob({
        notebookId: source.notebookId,
        sourceId,
        stage: 'embed',
        vaultId: source.vaultId?.trim() || vaultId
      })
      return
    }
    markGraphExtractForce(sourceId)
    await this.deps.repo.enqueueIngestJob({
      notebookId: source.notebookId,
      sourceId,
      stage: 'graph',
      vaultId: source.vaultId?.trim() || vaultId
    })
  }

  /**
   * 对 needs_ocr / partial 资料只 OCR 缺失页（或整份）。
   * 入队后立即返回，由 ingest consumer 异步执行，避免卡死主进程。
   */
  async ocrMissingPages(
    sourceId: string,
    options?: {
      engine?: ExtractEngineId
      pageNumbers?: number[]
    }
  ): Promise<{ queued: true }> {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)

    const engine = options?.engine ?? 'ocr'
    await this.deps.repo.updateSourceStatus(sourceId, 'pending', {
      errorMessage: null,
      extractEngine: engine
    })
    pendingExtractOverrides.set(sourceId, {
      forceEngine: engine,
      pageNumbers: options?.pageNumbers,
      onlyMissingPages: !options?.pageNumbers?.length
    })
    await this.deps.repo.enqueueIngestJob({
      notebookId: source.notebookId,
      sourceId,
      stage: 'extract',
      vaultId: source.vaultId?.trim() || vaultId
    })
    return { queued: true }
  }

  /**
   * 取消排队中或进行中的提取 / OCR。
   */
  async cancelExtract(sourceId: string): Promise<{ cancelled: true; status: string }> {
    requestExtractAbort(sourceId)
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)

    await this.deps.repo.deleteIngestJobsForSource(sourceId)
    if (source.status === 'embedding') {
      await this.deps.repo.updateSourceStatus(sourceId, 'failed', {
        errorMessage: 'cancelled'
      })
      return { cancelled: true, status: 'failed' }
    }
    const status = resolveStatusAfterCancel(source)
    await this.deps.repo.updateSourceStatus(sourceId, status, {
      errorMessage: status === 'failed' ? 'cancelled' : null
    })
    return { cancelled: true, status }
  }

  /**
   * 进程重启后恢复：只回收超时 lease（running → pending），不删 extract job。
   * live guard / 未超时的 running 不动。extracting 且已无 extract job 的资料打回 pending 并重新入队。
   */
  async recoverStaleIngestState(options?: { olderThanMs?: number }): Promise<{
    resetSources: number
    reclaimedEmbedJobs: number
    droppedExtractJobs: number
  }> {
    const vaultId = this.deps.getVaultId()?.trim()
    if (!vaultId) {
      return { resetSources: 0, reclaimedEmbedJobs: 0, droppedExtractJobs: 0 }
    }

    const reclaimedEmbedJobs = await this.deps.repo.reclaimStaleRunningIngestJobs({
      olderThanMs: options?.olderThanMs,
      vaultId,
      excludeSourceIds: [...embedLiveGuards, ...graphLiveGuards, ...extractLiveGuards]
    })

    let resetSources = 0
    const extracting = await this.deps.repo.listSourcesByStatus('extracting', { vaultId })
    for (const source of extracting) {
      if (isExtractProtected(source.id)) continue
      const jobs = await this.deps.repo.listIngestJobsBySource(source.id)
      const hasExtract = jobs.some(
        (job) =>
          job.stage === 'extract' && (job.status === 'pending' || job.status === 'running')
      )
      if (hasExtract) continue
      await this.deps.repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
      await this.deps.repo.enqueueIngestJob({
        notebookId: source.notebookId,
        sourceId: source.id,
        stage: 'extract',
        vaultId: source.vaultId?.trim() || vaultId
      })
      resetSources += 1
    }

    return { resetSources, reclaimedEmbedJobs, droppedExtractJobs: 0 }
  }

  async rebuildIndex(notebookId: string): Promise<void> {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const sources = await this.deps.repo.listSources(notebookId)
    await this.deps.repo.deleteChunksByNotebook(notebookId)
    for (const source of sources) {
      if (source.status === 'stored') continue
      if (!source.extractedTextHash && source.status === 'needs_ocr') continue
      await this.deps.repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
      await this.deps.repo.enqueueIngestJob({
        notebookId,
        sourceId: source.id,
        stage: 'embed',
        vaultId: source.vaultId?.trim() || vaultId
      })
      if (source.extractedTextHash) {
        await this.deps.repo.enqueueIngestJob({
          notebookId,
          sourceId: source.id,
          stage: 'graph',
          vaultId: source.vaultId?.trim() || vaultId
        })
      }
    }
  }

  async rebuildNotebookGraph(notebookId: string): Promise<void> {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const sources = await this.deps.repo.listSources(notebookId)
    for (const source of sources) {
      if (!source.extractedTextHash) continue
      markGraphExtractForce(source.id)
      await this.deps.repo.enqueueIngestJob({
        notebookId,
        sourceId: source.id,
        stage: 'graph',
        vaultId: source.vaultId?.trim() || vaultId
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
    // 先于任何 await 注册，避免 recoverStale 与 getSource 窗口竞态
    const abort = new AbortController()
    extractAbortControllers.set(sourceId, abort)

    try {
      const vaultId = requireVaultId(this.deps.getVaultId)
      const source = await this.deps.repo.getSource(sourceId)
      if (!source) throw new Error(`source not found: ${sourceId}`)

      const queued = pendingExtractOverrides.get(sourceId)
      if (queued) pendingExtractOverrides.delete(sourceId)
      const mergedOverride = {
        forceEngine: override?.forceEngine ?? queued?.forceEngine,
        pageNumbers: override?.pageNumbers ?? queued?.pageNumbers,
        onlyMissingPages: override?.onlyMissingPages ?? queued?.onlyMissingPages
      }

      throwIfExtractAborted(abort.signal)
      await this.deps.repo.updateSourceStatus(sourceId, 'extracting')

      return await this.runExtract(sourceId, source, vaultId, mergedOverride, abort.signal)
    } catch (e: unknown) {
      if (isExtractCancelled(e)) {
        const latest = await this.deps.repo.getSource(sourceId)
        if (latest) {
          const status = resolveStatusAfterCancel(latest)
          await this.deps.repo.updateSourceStatus(sourceId, status, {
            errorMessage: status === 'failed' ? 'cancelled' : null
          })
        }
        throw e
      }
      const message = e instanceof Error ? e.message : String(e)
      await this.deps.repo.updateSourceStatus(sourceId, 'failed', {
        errorMessage: message.slice(0, 500)
      })
      throw e
    } finally {
      endExtractAbort(sourceId, abort)
    }
  }

  private async runExtract(
    sourceId: string,
    source: Awaited<ReturnType<KnowledgeRepository['getSource']>> & object,
    vaultId: string,
    override?: {
      forceEngine?: ExtractEngineId
      pageNumbers?: number[]
      onlyMissingPages?: boolean
    },
    signal?: AbortSignal
  ): Promise<ExtractResult> {
    if (!source) throw new Error(`source not found: ${sourceId}`)
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
        kind: source.sourceKind === 'text' || source.sourceKind === 'note' ? 'text' : 'file',
        ext:
          source.sourceKind === 'text' || source.sourceKind === 'note'
            ? source.sourceKind === 'note'
              ? '.md'
              : '.txt'
            : ext,
        textContent: text
      })
    } else if (ext === '.epub') {
      result = await extractSourceContent({
        kind: 'file',
        ext: '.epub',
        absolutePath: abs
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
        const shouldMergeExisting =
          override?.onlyMissingPages ||
          Boolean(override?.pageNumbers?.length) ||
          resolved.engine === 'ocr' ||
          resolved.engine === 'vision'
        if (shouldMergeExisting) {
          const existing = await this.deps.notebookManager.readExtractedText(
            source.notebookId,
            sourceId
          )
          if (existing) {
            const pagesJson = await this.deps.notebookManager.readPagesJson(
              source.notebookId,
              sourceId
            )
            if (pagesJson?.pages?.length) {
              existingPageTexts = pagesJson.pages.map((p) => existing.slice(p.start, p.end))
            }
          }
        }
        const phase = resolved.engine === 'vision' ? 'vision' : 'ocr'
        const engineResult = await engine.extract({
          absolutePath: abs,
          pageNumbers: override?.pageNumbers,
          existingPageTexts,
          language: cfg.ocrLanguage,
          dpi: cfg.ocrDpi,
          concurrency: cfg.ocrConcurrency,
          signal,
          onProgress: (info) => {
            if (signal?.aborted) throw new Error('knowledge-extract-cancelled')
            this.deps.onExtractProgress?.({
              sourceId,
              page: info.page,
              total: info.total,
              phase
            })
          }
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

    // 页数未知：禁止进入 ready 路径，保持 needs_ocr
    const pageCountUnknown = !result.pageCount || result.pageCount <= 0
    if (ext === '.pdf' && pageCountUnknown) {
      result = {
        ...result,
        quality: 'needs_ocr',
        evidence: result.evidence || '无法确定 PDF 页数，禁止标 ready'
      }
    }

    // 取消可能发生在提取算完之后、写库之前：禁止成功路径覆盖取消态
    throwIfExtractAborted(signal)

    if (!result.text.trim() || result.quality === 'needs_ocr') {
      pendingProcessTargets.delete(sourceId)
      await this.deps.repo.updateSourceStatus(sourceId, 'needs_ocr', {
        errorMessage:
          [result.degradationMessage, result.evidence].filter(Boolean).join('；') || 'needs_ocr',
        pageCount: result.pageCount > 0 ? result.pageCount : null,
        textPageCount: result.textPageCount,
        extractEngine: usedEngine
      })
      await revertIfExtractAborted(this.deps.repo, sourceId, signal)
      if (result.text.trim()) {
        await this.deps.notebookManager.writeExtracted(
          source.notebookId,
          sourceId,
          result.text,
          result.pages
        )
        await revertIfExtractAborted(this.deps.repo, sourceId, signal)
      }
      return result
    }

    const { textHash } = await this.deps.notebookManager.writeExtracted(
      source.notebookId,
      sourceId,
      result.text,
      result.pages
    )
    await revertIfExtractAborted(this.deps.repo, sourceId, signal)

    const targets = takeProcessTargets(sourceId)
    const nextStatus =
      result.quality === 'partial' ? 'partial' : targets.embed ? 'embedding' : 'ready'
    await this.deps.repo.updateSourceStatus(sourceId, nextStatus, {
      extractedTextHash: textHash,
      pageCount: result.pageCount,
      textPageCount: result.textPageCount,
      extractEngine: usedEngine,
      errorMessage: [result.degradationMessage, result.evidence].filter(Boolean).join('；') || null
    })
    await revertIfExtractAborted(this.deps.repo, sourceId, signal)

    if (targets.embed) {
      await this.deps.repo.enqueueIngestJob({
        notebookId: source.notebookId,
        sourceId,
        stage: 'embed',
        vaultId: source.vaultId?.trim() || vaultId
      })
    }
    if (targets.graph) {
      await this.deps.repo.enqueueIngestJob({
        notebookId: source.notebookId,
        sourceId,
        stage: 'graph',
        vaultId: source.vaultId?.trim() || vaultId
      })
    }
    await revertIfExtractAborted(this.deps.repo, sourceId, signal)

    return result
  }

  async processGraphJob(sourceId: string): Promise<void> {
    const vaultId = requireVaultId(this.deps.getVaultId)
    const source = await this.deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)
    const text = await this.deps.notebookManager.readExtractedText(source.notebookId, sourceId)
    if (!text?.trim()) {
      throw new Error('extracted text missing')
    }
    if (!this.deps.extractNotebookGraph) {
      throw new Error('graph-extract-not-configured')
    }
    const pages = await this.deps.notebookManager.readPagesJson(source.notebookId, sourceId)
    const force = peekGraphExtractForce(sourceId)
    try {
      await this.deps.extractNotebookGraph({
        vaultId: source.vaultId?.trim() || vaultId,
        notebookId: source.notebookId,
        sourceId,
        sourceTitle: source.title,
        text,
        textHash: source.extractedTextHash || '',
        pages: pages?.pages ?? null,
        force
      })
      clearGraphExtractForce(sourceId)
    } catch (error) {
      if (!force) clearGraphExtractForce(sourceId)
      throw error
    }
  }

  async processEmbedJob(sourceId: string): Promise<void> {
    const vaultId = requireVaultId(this.deps.getVaultId)
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

    const modelId = embeddingCfg?.getModelId() ?? 'mock'
    const chunks = splitTextIntoChunks(text)
    let charCursor = 0
    const chunkVaultId = source.vaultId?.trim() || vaultId

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
        modelId,
        vaultId: chunkVaultId
      })
    }

    await this.deps.repo.deleteChunksBySourceFromIndex(sourceId, chunks.length)

    const pageCount = source.pageCount
    const textPageCount = source.textPageCount
    const isPdfLike =
      source.sourceKind === 'file' && (source.relativePath || '').toLowerCase().endsWith('.pdf')

    // 页数未知禁止标 ready（尤其 PDF）
    if (isPdfLike && (pageCount == null || pageCount <= 0)) {
      await this.deps.repo.updateSourceStatus(sourceId, 'needs_ocr', {
        errorMessage: '页数未知，禁止标 ready'
      })
      logger.info('[KnowledgeIngest] embed done but pageCount unknown → needs_ocr', {
        sourceId
      })
      return
    }

    const stillPartial =
      pageCount != null && textPageCount != null && pageCount > 0 && textPageCount / pageCount < 0.9

    await this.deps.repo.updateSourceStatus(sourceId, stillPartial ? 'partial' : 'ready', {
      errorMessage: stillPartial ? source.errorMessage : null
    })

    logger.info('[KnowledgeIngest] embed done', { sourceId, chunks: chunks.length })
  }
}
