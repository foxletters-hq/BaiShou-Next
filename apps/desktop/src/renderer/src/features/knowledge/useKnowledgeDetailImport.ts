import { useCallback, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import {
  normalizeKnowledgeImportProcessMode,
  resolveGlobalGraphModelIds,
  type KnowledgeExtractHint,
  type KnowledgeExtractHintChoice,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { collectVisionExtractHints, pickVisionExtractHintReason } from './extract-engine-hint.util'
import { extractEngineShortLabel } from './knowledge-detail-labels.util'
import type { KnowledgeImportMode, KnowledgeUploadingSource } from './knowledge-detail.types'

export function useKnowledgeDetailImport(input: {
  notebookId: string
  engine: 'simple' | 'ocr' | 'vision'
  globalModels: {
    globalEmbeddingModelId?: string
    globalGraphModelId?: string
    globalGraphProviderId?: string
  } | null
  t: TFunction
  refresh: () => Promise<void>
  setError: (message: string) => void
  setStatus: (message: string) => void
  setBusy: (busy: boolean) => void
}) {
  const { notebookId, engine, globalModels, t, refresh, setError, setStatus, setBusy } = input
  const [importMode, setImportMode] = useState<KnowledgeImportMode>(null)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [uploadingSources, setUploadingSources] = useState<KnowledgeUploadingSource[]>([])
  const [extractHintPrompt, setExtractHintPrompt] = useState<{
    fileNames: string[]
    reason: KnowledgeExtractHint['reason']
    currentEngine: 'simple' | 'ocr' | 'vision'
    visionConfigured: boolean
    visionModelId?: string | null
  } | null>(null)
  const extractHintResolver = useRef<((choice: KnowledgeExtractHintChoice) => void) | null>(null)
  const [importProcessPrompt, setImportProcessPrompt] = useState<{
    fileNames: string[]
    extractEngineLabel: string
    embeddingModelLabel: string
    graphModelLabel: string
    defaultMode: KnowledgeImportProcessMode
  } | null>(null)
  const importProcessResolver = useRef<((mode: KnowledgeImportProcessMode | null) => void) | null>(
    null
  )

  const openAddSource = useCallback(() => {
    setImportMode('chooser')
  }, [])

  const settleExtractHint = useCallback((choice: KnowledgeExtractHintChoice) => {
    const resolve = extractHintResolver.current
    extractHintResolver.current = null
    setExtractHintPrompt(null)
    resolve?.(choice)
  }, [])

  const settleImportProcess = useCallback((mode: KnowledgeImportProcessMode | null) => {
    const resolve = importProcessResolver.current
    importProcessResolver.current = null
    setImportProcessPrompt(null)
    resolve?.(mode)
  }, [])

  const askExtractHint = useCallback(
    (prompt: {
      fileNames: string[]
      reason: KnowledgeExtractHint['reason']
      currentEngine: 'simple' | 'ocr' | 'vision'
      visionConfigured: boolean
      visionModelId?: string | null
    }) =>
      new Promise<KnowledgeExtractHintChoice>((resolve) => {
        extractHintResolver.current = resolve
        setExtractHintPrompt(prompt)
      }),
    []
  )

  const askImportProcess = useCallback(
    async (askInput: { fileNames: string[]; extractEngineLabel: string }) => {
      let defaultMode: KnowledgeImportProcessMode = 'both'
      try {
        const cfg = await window.api.knowledge.getConfig()
        defaultMode = normalizeKnowledgeImportProcessMode(cfg.importProcessMode)
      } catch {
        /* 读不到配置时按立刻处理 */
      }
      const embeddingModelLabel =
        globalModels?.globalEmbeddingModelId?.trim() ||
        t('knowledge.import_process_model_missing', '未配置')
      const graphModelLabel =
        resolveGlobalGraphModelIds(globalModels).modelId ||
        t('knowledge.import_process_model_missing', '未配置')
      return new Promise<KnowledgeImportProcessMode | null>((resolve) => {
        importProcessResolver.current = resolve
        setImportProcessPrompt({
          fileNames: askInput.fileNames,
          extractEngineLabel: askInput.extractEngineLabel,
          embeddingModelLabel,
          graphModelLabel,
          defaultMode
        })
      })
    },
    [globalModels, t]
  )

  const onImportFile = async () => {
    if (!notebookId) return
    setError('')
    try {
      const files = await window.api.pickFiles({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Documents', extensions: ['pdf', 'epub', 'md', 'txt', 'markdown'] }]
      })
      if (!files?.length) return

      setImportMode(null)
      const pending = files.map((file, index) => ({
        localId: `upload-${file.id || `${Date.now()}-${index}`}`,
        fileName: file.fileName || 'file',
        fileSize: file.fileSize || 0,
        progress: 4,
        filePath: file.filePath
      }))
      setUploadingSources((prev) => [
        ...pending.map(({ localId, fileName, fileSize, progress }) => ({
          localId,
          fileName,
          fileSize,
          progress
        })),
        ...prev
      ])

      const hintedPaths = new Set<string>()
      let hintedEngine: 'simple' | 'ocr' | 'vision' = engine
      if (engine !== 'vision') {
        const probed: KnowledgeExtractHint[] = []
        setStatus(t('knowledge.extract_hint_probing', '正在检测文字层…'))
        for (const item of pending) {
          if (!item.filePath || !item.fileName.toLowerCase().endsWith('.pdf')) continue
          try {
            const hint = await window.api.knowledge.probeExtractHint({
              absolutePath: item.filePath
            })
            if (hint.recommendVision) {
              probed.push(hint)
              hintedPaths.add(item.filePath)
            }
          } catch {
            /* 探测失败不拦导入 */
          }
        }
        const hinted = collectVisionExtractHints(probed)
        if (hinted.length > 0) {
          const choice = await askExtractHint({
            fileNames: hinted.map((row) => row.fileName),
            reason: pickVisionExtractHintReason(hinted),
            currentEngine: engine,
            visionConfigured: hinted.some((row) => row.visionConfigured),
            visionModelId: hinted.find((row) => row.visionModelId)?.visionModelId
          })
          if (choice === 'cancel') {
            setUploadingSources((prev) =>
              prev.filter((row) => !pending.some((item) => item.localId === row.localId))
            )
            setStatus('')
            return
          }
          if (choice === 'vision') hintedEngine = 'vision'
          else if (choice === 'ocr') hintedEngine = 'ocr'
        }
        setStatus('')
      }

      const processChoice = await askImportProcess({
        fileNames: pending.map((item) => item.fileName),
        extractEngineLabel: extractEngineShortLabel(t, hintedEngine)
      })
      if (!processChoice) {
        setUploadingSources((prev) =>
          prev.filter((row) => !pending.some((item) => item.localId === row.localId))
        )
        return
      }
      let imported = 0
      for (const item of pending) {
        const tick = window.setInterval(() => {
          setUploadingSources((prev) =>
            prev.map((row) => {
              if (row.localId !== item.localId || row.progress >= 90 || row.error) return row
              const step = Math.max(
                2,
                Math.round(100 / Math.max(8, (row.fileSize || 1) / (256 * 1024)))
              )
              return { ...row, progress: Math.min(90, row.progress + step) }
            })
          )
        }, 180)

        try {
          await window.api.knowledge.importSource({
            notebookId,
            title: item.fileName,
            kind: 'file',
            absolutePath: item.filePath,
            fileName: item.fileName,
            extractEngine: item.filePath && hintedPaths.has(item.filePath) ? hintedEngine : engine,
            importProcessMode: processChoice
          })
          imported += 1
          setUploadingSources((prev) =>
            prev.map((row) => (row.localId === item.localId ? { ...row, progress: 100 } : row))
          )
          await new Promise((r) => window.setTimeout(r, 220))
          setUploadingSources((prev) => prev.filter((row) => row.localId !== item.localId))
        } catch (e: any) {
          const message = String(e?.message || e)
          setUploadingSources((prev) =>
            prev.map((row) =>
              row.localId === item.localId ? { ...row, progress: 100, error: message } : row
            )
          )
          setError(message)
        } finally {
          window.clearInterval(tick)
        }
      }

      await refresh()
      if (imported > 0) {
        setStatus(
          processChoice === 'later'
            ? t('knowledge.import_stored', '已保存为待整理')
            : t('knowledge.import_queued', '已加入摄入队列')
        )
      }
    } catch (e: any) {
      setError(String(e?.message || e))
    }
  }

  const onImportText = async () => {
    if (!notebookId || !pasteText.trim()) return
    const title = pasteTitle.trim() || t('knowledge.pasted_text', '粘贴文本')
    const processChoice = await askImportProcess({
      fileNames: [title],
      extractEngineLabel: t('knowledge.import_process_engine_text', '原文文本')
    })
    if (!processChoice) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.importSource({
        notebookId,
        title,
        kind: 'text',
        textContent: pasteText,
        importProcessMode: processChoice
      })
      setImportMode(null)
      setPasteTitle('')
      setPasteText('')
      await refresh()
      setStatus(
        processChoice === 'later'
          ? t('knowledge.import_stored', '已保存为待整理')
          : t('knowledge.import_queued', '已加入摄入队列')
      )
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportUrl = async () => {
    const originUrl = urlValue.trim()
    if (!notebookId || !originUrl) return
    const processChoice = await askImportProcess({
      fileNames: [originUrl],
      extractEngineLabel: t('knowledge.import_process_engine_text', '原文文本')
    })
    if (!processChoice) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.importSource({
        notebookId,
        title: '',
        kind: 'url',
        originUrl,
        importProcessMode: processChoice
      })
      setImportMode(null)
      setUrlValue('')
      await refresh()
      setStatus(
        processChoice === 'later'
          ? t('knowledge.import_stored', '已保存为待整理')
          : t('knowledge.import_queued', '已加入摄入队列')
      )
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const dismissUploadError = (localId: string) => {
    setUploadingSources((prev) => prev.filter((row) => row.localId !== localId))
  }

  return {
    importMode,
    setImportMode,
    pasteTitle,
    setPasteTitle,
    pasteText,
    setPasteText,
    urlValue,
    setUrlValue,
    uploadingSources,
    extractHintPrompt,
    importProcessPrompt,
    openAddSource,
    settleExtractHint,
    settleImportProcess,
    askExtractHint,
    onImportFile,
    onImportText,
    onImportUrl,
    dismissUploadError
  }
}
