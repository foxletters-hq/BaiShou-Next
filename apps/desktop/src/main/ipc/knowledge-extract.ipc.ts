import path from 'path'
import { BrowserWindow } from 'electron'
import {
  loadExtractedKnowledgeWindows,
  probeExtractEngineCapabilities,
  probeKnowledgeExtractSample,
  probePdfPageTexts,
  recommendVisionExtract,
  type ExtractEngineId
} from '@baishou/core-desktop'
import {
  clampOcrConcurrency,
  normalizeKnowledgeDefaultExtractEngine,
  normalizeKnowledgeImportProcessMode,
  type KnowledgeConfig
} from '@baishou/shared'
import { scheduleConsumeKnowledgeIngestJobs } from '../services/knowledge-ingest-jobs.consumer'
import { getNotebookRawManager } from '../services/raw-data-source.runtime'
import { settingsManager } from './settings.ipc'
import {
  getKnowledgeIngestService,
  handleKnowledgeIpc,
  loadKnowledgeConfig,
  requireKnowledgeRepo,
  resetKnowledgeIngestService,
  resolveVisionConfigured
} from './knowledge-ipc.context'

export function registerKnowledgeExtractIpc(): void {
  handleKnowledgeIpc(
    'knowledge:probe-extract-hint',
    async (_e, input: { absolutePath?: string; sourceId?: string }) => {
      let filePath = String(input?.absolutePath || '').trim()
      let fileName = filePath ? path.basename(filePath) : ''
      if (!filePath && input?.sourceId) {
        const repo = requireKnowledgeRepo()
        const source = await repo.getSource(String(input.sourceId))
        if (!source?.relativePath) throw new Error('source file not found')
        filePath = await getNotebookRawManager().absolutePath(source.relativePath)
        fileName = source.title || path.basename(filePath)
      }
      if (!filePath) throw new Error('absolutePath or sourceId required')
      const vision = await resolveVisionConfigured()
      const ext = path.extname(filePath).toLowerCase()
      if (ext !== '.pdf') {
        return {
          recommendVision: false,
          reason: null,
          sampledPages: 0,
          usableTextPages: 0,
          garbledPages: 0,
          emptyPages: 0,
          fileName,
          visionConfigured: vision.configured,
          visionModelId: vision.modelId
        }
      }
      const pages = await probePdfPageTexts(filePath, 12)
      const hint = recommendVisionExtract(pages)
      return {
        ...hint,
        fileName,
        visionConfigured: vision.configured,
        visionModelId: vision.modelId
      }
    }
  )

  handleKnowledgeIpc(
    'knowledge:ocr-missing-pages',
    async (
      _e,
      input: {
        sourceId: string
        engine?: ExtractEngineId
        pageNumbers?: number[]
      }
    ) => {
      const svc = getKnowledgeIngestService()
      const result = await svc.ocrMissingPages(input.sourceId, {
        engine: input.engine,
        pageNumbers: input.pageNumbers
      })
      scheduleConsumeKnowledgeIngestJobs('after-ocr')
      return result
    }
  )

  handleKnowledgeIpc('knowledge:cancel-extract', async (_e, sourceId: string) => {
    const svc = getKnowledgeIngestService()
    const result = await svc.cancelExtract(sourceId)
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      try {
        win.webContents.send('knowledge:ocr-progress', {
          sourceId,
          page: 0,
          total: 0,
          phase: 'ocr'
        })
      } catch {
        /* ignore */
      }
    }
    return result
  })

  handleKnowledgeIpc('knowledge:recover-stale', async () => {
    const svc = getKnowledgeIngestService()
    return svc.recoverStaleIngestState()
  })

  handleKnowledgeIpc(
    'knowledge:probe-extract-sample',
    async (
      _e,
      input: {
        notebookId?: string
        sourceId: string
        engine: ExtractEngineId
        ocrLanguage?: string
        ocrConcurrency?: number
        visionProviderId?: string | null
        visionModelId?: string | null
      }
    ) => {
      const sourceId = String(input?.sourceId || '').trim()
      if (!sourceId) throw new Error('sourceId required')
      const repo = requireKnowledgeRepo()
      const source = await repo.getSource(sourceId)
      if (!source) throw new Error(`source not found: ${sourceId}`)
      const notebookId = String(input?.notebookId || '').trim()
      if (notebookId && source.notebookId !== notebookId) {
        throw new Error('source not in notebook')
      }
      if (!source.relativePath) throw new Error('source file not found')
      const abs = await getNotebookRawManager().absolutePath(source.relativePath)
      const cfg = await loadKnowledgeConfig()
      const engine = normalizeKnowledgeDefaultExtractEngine(input.engine)
      return probeKnowledgeExtractSample({
        source,
        absolutePath: abs,
        engine,
        language: input.ocrLanguage ?? cfg.ocrLanguage,
        dpi: cfg.ocrDpi,
        concurrency: clampOcrConcurrency(input.ocrConcurrency ?? cfg.ocrConcurrency),
        visionProviderId: input.visionProviderId,
        visionModelId: input.visionModelId
      })
    }
  )

  handleKnowledgeIpc('knowledge:get-capabilities', async () => {
    const cfg = await loadKnowledgeConfig()
    const vision = await resolveVisionConfigured()
    return probeExtractEngineCapabilities({
      visionModelConfigured: vision.configured,
      visionModelId: vision.modelId,
      ocrLanguage: cfg.ocrLanguage
    })
  })

  handleKnowledgeIpc('knowledge:get-config', async () => loadKnowledgeConfig())

  handleKnowledgeIpc('knowledge:set-config', async (_e, patch: KnowledgeConfig) => {
    const current = await loadKnowledgeConfig()
    const next = { ...current, ...patch }
    if (next.ocrConcurrency !== undefined) {
      next.ocrConcurrency = clampOcrConcurrency(next.ocrConcurrency)
    }
    if (patch.importProcessMode !== undefined) {
      next.importProcessMode = normalizeKnowledgeImportProcessMode(patch.importProcessMode)
    }
    next.defaultExtractEngine = normalizeKnowledgeDefaultExtractEngine(next.defaultExtractEngine)
    await settingsManager.set('knowledge_config', next)
    resetKnowledgeIngestService()
    return next
  })

  handleKnowledgeIpc(
    'knowledge:get-extracted-preview',
    async (_e, input: { notebookId: string; sourceId: string; maxChars?: number }) => {
      const notebookManager = getNotebookRawManager()
      const text = await notebookManager.readExtractedText(input.notebookId, input.sourceId)
      if (text == null) return { text: null as string | null, truncated: false }
      const max = Math.max(200, input.maxChars ?? 4000)
      if (text.length <= max) return { text, truncated: false }
      return { text: text.slice(0, max), truncated: true }
    }
  )

  handleKnowledgeIpc(
    'knowledge:get-extracted-windows',
    async (
      _e,
      input: {
        notebookId: string
        windows: Array<{ sourceId: string; windowIndex: number }>
      }
    ) => {
      const notebookId = String(input?.notebookId || '').trim()
      if (!notebookId) throw new Error('notebookId required')
      const repo = requireKnowledgeRepo()
      const notebookManager = getNotebookRawManager()
      const items = await loadExtractedKnowledgeWindows({
        notebookId,
        windows: Array.isArray(input?.windows) ? input.windows : [],
        readExtractedText: (nb, sourceId) => notebookManager.readExtractedText(nb, sourceId),
        readPagesJson: (nb, sourceId) => notebookManager.readPagesJson(nb, sourceId),
        getSource: async (sourceId) => {
          const source = await repo.getSource(sourceId)
          return source ? { notebookId: source.notebookId, title: source.title } : null
        }
      })
      return { items }
    }
  )
}
