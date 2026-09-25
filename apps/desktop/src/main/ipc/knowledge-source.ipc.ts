import path from 'path'
import { fetchUrlAsMarkdown } from '@baishou/ai'
import {
  normalizeKnowledgeDefaultExtractEngine,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { extractEpubPageTexts, type ExtractEngineId } from '@baishou/core-desktop'
import { toLocalProtocolFileUrl } from '../local-protocol.util'
import { scheduleConsumeKnowledgeIngestJobs } from '../services/knowledge-ingest-jobs.consumer'
import { getNotebookRawManager } from '../services/raw-data-source.runtime'
import { fileSystem } from '../services/node-file-system'
import { resolveKnowledgeImportDefer } from './knowledge-import.util'
import { classifyKnowledgeSourceFile } from './knowledge-source-file.util'
import {
  getKnowledgeIngestService,
  handleKnowledgeIpc,
  loadKnowledgeConfig,
  requireKnowledgeRepo
} from './knowledge-ipc.context'

export function registerKnowledgeSourceIpc(): void {
  handleKnowledgeIpc(
    'knowledge:import-source',
    async (
      _e,
      input: {
        notebookId: string
        title: string
        kind: 'file' | 'text' | 'url' | 'note'
        absolutePath?: string
        textContent?: string
        fileName?: string
        originUrl?: string
        extractEngine?: ExtractEngineId
        importProcessMode?: KnowledgeImportProcessMode | string
      }
    ) => {
      const svc = getKnowledgeIngestService()
      const cfg = await loadKnowledgeConfig()
      let payload = { ...input }

      if (input.kind === 'url') {
        const originUrl = (input.originUrl || input.textContent || '').trim()
        if (!originUrl) throw new Error('import url requires originUrl')
        const fetched = await fetchUrlAsMarkdown(originUrl, { allowPrivateNetwork: true })
        if (!fetched.markdown?.trim()) {
          throw new Error('URL content empty or could not be parsed')
        }
        payload = {
          ...input,
          kind: 'url',
          originUrl: fetched.finalUrl || originUrl,
          title: input.title?.trim() || fetched.title || originUrl,
          textContent: fetched.markdown,
          fileName: `${(input.title || fetched.title || 'page').slice(0, 40)}.md`
        }
      }

      const { importProcessMode, deferOrganize } = resolveKnowledgeImportDefer(
        input.importProcessMode
      )
      const result = await svc.importSource({
        ...payload,
        importProcessMode: deferOrganize ? 'later' : importProcessMode,
        extractEngine:
          input.extractEngine ||
          cfg.defaultExtractEngine ||
          normalizeKnowledgeDefaultExtractEngine(undefined),
        fileName:
          payload.fileName ||
          (payload.absolutePath ? path.basename(payload.absolutePath) : payload.title)
      })
      if (!deferOrganize) {
        scheduleConsumeKnowledgeIngestJobs('after-import')
      }
      return result
    }
  )

  handleKnowledgeIpc('knowledge:retry-source', async (_e, sourceId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.retrySource(sourceId)
    scheduleConsumeKnowledgeIngestJobs('after-retry')
    return { ok: true }
  })

  handleKnowledgeIpc(
    'knowledge:reprocess-source',
    async (_e, input: { sourceId: string; target: 'embed' | 'graph' }) => {
      const sourceId = String(input?.sourceId || '')
      const target = input?.target === 'graph' ? 'graph' : 'embed'
      const svc = getKnowledgeIngestService()
      await svc.reprocessSource(sourceId, target)
      scheduleConsumeKnowledgeIngestJobs('after-reprocess')
      return { ok: true }
    }
  )

  handleKnowledgeIpc('knowledge:delete-source', async (_e, sourceId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.deleteSource(String(sourceId || ''))
    return { ok: true }
  })

  handleKnowledgeIpc('knowledge:rebuild-index', async (_e, notebookId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.rebuildIndex(notebookId)
    scheduleConsumeKnowledgeIngestJobs('after-rebuild')
    return { ok: true }
  })

  handleKnowledgeIpc('knowledge:organize-notebook', async (_e, notebookId: string) => {
    const svc = getKnowledgeIngestService()
    const result = await svc.organizeNotebook(String(notebookId || ''))
    scheduleConsumeKnowledgeIngestJobs('after-organize-notebook')
    return result
  })

  handleKnowledgeIpc(
    'knowledge:manage-data',
    async (
      _e,
      input: {
        notebookId?: string
        action?: 'clear' | 'reprocess'
        vector?: boolean
        graph?: boolean
      }
    ) => {
      const svc = getKnowledgeIngestService()
      const result = await svc.manageNotebookData(String(input?.notebookId || ''), {
        action: input?.action === 'clear' ? 'clear' : 'reprocess',
        vector: Boolean(input?.vector),
        graph: Boolean(input?.graph)
      })
      if (input?.action !== 'clear') {
        scheduleConsumeKnowledgeIngestJobs('after-manage-data')
      }
      return result
    }
  )

  handleKnowledgeIpc('knowledge:get-source-file', async (_e, input: { sourceId: string }) => {
    const repo = requireKnowledgeRepo()
    const source = await repo.getSource(input.sourceId)
    if (!source) throw new Error(`source not found: ${input.sourceId}`)

    const notebookManager = getNotebookRawManager()
    const fileNameFromPath = source.relativePath ? path.basename(source.relativePath) : source.title
    const ext = path.extname(fileNameFromPath || '').toLowerCase()
    const kind = classifyKnowledgeSourceFile({
      hasRelativePath: Boolean(source.relativePath),
      sourceKind: source.sourceKind,
      ext
    })

    if (!source.relativePath) {
      return {
        kind: 'unsupported' as const,
        fileName: source.title,
        localUrl: null as string | null,
        fileBytes: null as Uint8Array | null,
        textContent: null as string | null,
        originUrl: source.originUrl ?? null
      }
    }

    const abs = await notebookManager.absolutePath(source.relativePath)
    const localUrl = toLocalProtocolFileUrl(abs)

    if (kind === 'pdf') {
      return {
        kind: 'pdf' as const,
        fileName: fileNameFromPath || source.title,
        localUrl,
        fileBytes: null as Uint8Array | null,
        textContent: null as string | null,
        originUrl: source.originUrl ?? null
      }
    }

    if (kind === 'epub') {
      const encoded = await fileSystem.readFile(abs, 'base64')
      let pages: string[]
      try {
        pages = extractEpubPageTexts(Buffer.from(encoded, 'base64'))
      } catch {
        throw new Error('这份 EPUB 暂时无法预览')
      }
      return {
        kind: 'epub' as const,
        fileName: fileNameFromPath || source.title,
        localUrl,
        fileBytes: null as Uint8Array | null,
        textContent: null as string | null,
        pages,
        originUrl: source.originUrl ?? null
      }
    }

    if (kind === 'text' || kind === 'url') {
      const textContent = await fileSystem.readFile(abs, 'utf8')
      return {
        kind,
        fileName: fileNameFromPath || source.title,
        localUrl,
        fileBytes: null as Uint8Array | null,
        textContent,
        originUrl: source.originUrl ?? null
      }
    }

    return {
      kind: 'unsupported' as const,
      fileName: fileNameFromPath || source.title,
      localUrl,
      fileBytes: null as Uint8Array | null,
      textContent: null as string | null,
      originUrl: source.originUrl ?? null
    }
  })
}
