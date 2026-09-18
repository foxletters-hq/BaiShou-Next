import type { KnowledgeRepository } from '@baishou/database/shared'
import { extractSourceContent, type ExtractResult } from './knowledge-extract'
import { probeExtractEngineCapabilities, resolveExtractEngine } from './extract-engine-capabilities'
import { getExtractEngine, type ExtractEngineId } from './extract-engines'
import type { KnowledgeExtractOverride, KnowledgeIngestDeps } from './knowledge-ingest.types'
import { extOf, requireVaultId } from './knowledge-ingest.helpers'
import {
  beginExtractAbort,
  clearProcessTargets,
  endExtractAbort,
  isExtractCancelled,
  markGraphFollowAfterEmbed,
  resolveStatusAfterCancel,
  revertIfExtractAborted,
  takePendingExtractOverride,
  takeProcessTargets,
  throwIfExtractAborted
} from './knowledge-ingest.jobs'

export async function processExtractJob(
  deps: KnowledgeIngestDeps,
  sourceId: string,
  override?: KnowledgeExtractOverride
): Promise<ExtractResult> {
  // 先于任何 await 注册，避免 recoverStale 与 getSource 窗口竞态
  const abort = beginExtractAbort(sourceId)

  try {
    const vaultId = requireVaultId(deps.getVaultId)
    const source = await deps.repo.getSource(sourceId)
    if (!source) throw new Error(`source not found: ${sourceId}`)

    const queued = takePendingExtractOverride(sourceId)
    const mergedOverride: KnowledgeExtractOverride = {
      forceEngine: override?.forceEngine ?? queued?.forceEngine,
      pageNumbers: override?.pageNumbers ?? queued?.pageNumbers,
      onlyMissingPages: override?.onlyMissingPages ?? queued?.onlyMissingPages
    }

    throwIfExtractAborted(abort.signal)
    await deps.repo.updateSourceStatus(sourceId, 'extracting')

    return await runExtract(deps, sourceId, source, vaultId, mergedOverride, abort.signal)
  } catch (e: unknown) {
    if (isExtractCancelled(e)) {
      const latest = await deps.repo.getSource(sourceId)
      if (latest) {
        const status = resolveStatusAfterCancel(latest)
        await deps.repo.updateSourceStatus(sourceId, status, {
          errorMessage: status === 'failed' ? 'cancelled' : null
        })
      }
      throw e
    }
    const message = e instanceof Error ? e.message : String(e)
    await deps.repo.updateSourceStatus(sourceId, 'failed', {
      errorMessage: message.slice(0, 500)
    })
    throw e
  } finally {
    endExtractAbort(sourceId, abort)
  }
}

async function runExtract(
  deps: KnowledgeIngestDeps,
  sourceId: string,
  source: Awaited<ReturnType<KnowledgeRepository['getSource']>> & object,
  vaultId: string,
  override?: KnowledgeExtractOverride,
  signal?: AbortSignal
): Promise<ExtractResult> {
  if (!source) throw new Error(`source not found: ${sourceId}`)
  const rel = source.relativePath
  if (!rel) throw new Error(`source ${sourceId} missing relativePath`)
  const abs = await deps.notebookManager.absolutePath(rel)
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
    const text = await deps.fs.readFile(abs, 'utf8')
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
    const cfg = (await deps.getExtractConfig?.()) ?? {}
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
        const existing = await deps.notebookManager.readExtractedText(source.notebookId, sourceId)
        if (existing) {
          const pagesJson = await deps.notebookManager.readPagesJson(source.notebookId, sourceId)
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
          deps.onExtractProgress?.({
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
    clearProcessTargets(sourceId)
    await deps.repo.updateSourceStatus(sourceId, 'needs_ocr', {
      errorMessage:
        [result.degradationMessage, result.evidence].filter(Boolean).join('；') || 'needs_ocr',
      pageCount: result.pageCount > 0 ? result.pageCount : null,
      textPageCount: result.textPageCount,
      extractEngine: usedEngine
    })
    await revertIfExtractAborted(deps.repo, sourceId, signal)
    if (result.text.trim()) {
      await deps.notebookManager.writeExtracted(
        source.notebookId,
        sourceId,
        result.text,
        result.pages
      )
      await revertIfExtractAborted(deps.repo, sourceId, signal)
    }
    return result
  }

  const { textHash } = await deps.notebookManager.writeExtracted(
    source.notebookId,
    sourceId,
    result.text,
    result.pages
  )
  await revertIfExtractAborted(deps.repo, sourceId, signal)
  if (source.extractedTextHash && source.extractedTextHash !== textHash) {
    await deps.repo.deleteEmbedLedgerBySource(sourceId)
  }

  const targets = takeProcessTargets(sourceId)
  const shouldQueueEmbed = targets.embed || targets.graph
  const nextStatus =
    result.quality === 'partial' ? 'partial' : shouldQueueEmbed ? 'embedding' : 'ready'
  await deps.repo.updateSourceStatus(sourceId, nextStatus, {
    extractedTextHash: textHash,
    pageCount: result.pageCount,
    textPageCount: result.textPageCount,
    extractEngine: usedEngine,
    errorMessage: [result.degradationMessage, result.evidence].filter(Boolean).join('；') || null
  })
  await revertIfExtractAborted(deps.repo, sourceId, signal)

  if (targets.graph) {
    markGraphFollowAfterEmbed(sourceId)
  }
  if (shouldQueueEmbed) {
    await deps.repo.enqueueIngestJob({
      notebookId: source.notebookId,
      sourceId,
      stage: 'embed',
      vaultId: source.vaultId?.trim() || vaultId
    })
  }
  await revertIfExtractAborted(deps.repo, sourceId, signal)

  return result
}
