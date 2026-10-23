import { useCallback, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import {
  collectVisionExtractHints,
  normalizeKnowledgeImportProcessMode,
  pickVisionExtractHintReason,
  shouldDeferKnowledgeImportOrganize,
  type KnowledgeExtractHint,
  type KnowledgeExtractHintChoice,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'
import * as DocumentPicker from 'expo-document-picker'
import {
  mobileGetKnowledgeConfig,
  mobileImportSource,
  resolveMobileKnowledgeFilePath
} from '@/src/services/mobile-knowledge.service'
import { mobileProbeExtractHint } from '@/src/services/mobile-knowledge-preview.service'
import { extractEngineShortLabel, knowledgeIngestUserMessage } from './knowledge-screen.util'
import type { KnowledgeImportMode } from './knowledge-detail.types'

export function useKnowledgeDetailImport(input: {
  notebookId: string
  embeddingModelLabel: string
  graphModelLabel: string
  t: TFunction
  toast: ReturnType<typeof useNativeToast>
  setBusy: (busy: boolean) => void
  setError: (message: string) => void
  refreshDetail: () => Promise<void>
}) {
  const {
    notebookId,
    embeddingModelLabel,
    graphModelLabel,
    t,
    toast,
    setBusy,
    setError,
    refreshDetail
  } = input
  const [importMode, setImportMode] = useState<KnowledgeImportMode>(null)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [uploadingSources, setUploadingSources] = useState<
    Array<{ localId: string; fileName: string; status: 'importing' | 'failed'; error?: string }>
  >([])
  const [extractHintPrompt, setExtractHintPrompt] = useState<{
    fileNames: string[]
    reason: KnowledgeExtractHint['reason']
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
        const cfg = await mobileGetKnowledgeConfig()
        defaultMode = normalizeKnowledgeImportProcessMode(cfg.importProcessMode)
      } catch {
        /* 读不到配置时按立刻处理 */
      }
      const missing = t('knowledge.import_process_model_missing', '未配置')
      return new Promise<KnowledgeImportProcessMode | null>((resolve) => {
        importProcessResolver.current = resolve
        setImportProcessPrompt({
          fileNames: askInput.fileNames,
          extractEngineLabel: askInput.extractEngineLabel,
          embeddingModelLabel: embeddingModelLabel.trim() || missing,
          graphModelLabel: graphModelLabel.trim() || missing,
          defaultMode
        })
      })
    },
    [embeddingModelLabel, graphModelLabel, t]
  )

  const onImportText = async () => {
    if (!pasteText.trim()) return
    const title = pasteTitle.trim() || t('knowledge.pasted_text', '粘贴文本')
    const processChoice = await askImportProcess({
      fileNames: [title],
      extractEngineLabel: t('knowledge.import_process_engine_text', '原文文本')
    })
    if (!processChoice) return
    setBusy(true)
    setError('')
    try {
      await mobileImportSource({
        notebookId,
        title,
        kind: 'text',
        textContent: pasteText,
        importProcessMode: processChoice
      })
      setPasteTitle('')
      setPasteText('')
      setImportMode(null)
      await refreshDetail()
      toast.showSuccess(
        shouldDeferKnowledgeImportOrganize(processChoice)
          ? t('knowledge.import_stored', '已保存为待整理')
          : t('knowledge.import_queued', '已加入整理队列')
      )
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const onImportUrl = async () => {
    const originUrl = urlValue.trim()
    if (!originUrl) return
    const processChoice = await askImportProcess({
      fileNames: [originUrl],
      extractEngineLabel: t('knowledge.import_process_engine_text', '原文文本')
    })
    if (!processChoice) return
    setBusy(true)
    setError('')
    try {
      await mobileImportSource({
        notebookId,
        title: '',
        kind: 'url',
        originUrl,
        importProcessMode: processChoice
      })
      setUrlValue('')
      setImportMode(null)
      await refreshDetail()
      toast.showSuccess(
        shouldDeferKnowledgeImportOrganize(processChoice)
          ? t('knowledge.import_stored', '已保存为待整理')
          : t('knowledge.import_queued', '已加入整理队列')
      )
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const onImportFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/epub+zip', 'text/plain', 'text/markdown'],
      copyToCacheDirectory: true,
      multiple: true
    })
    if (picked.canceled || !picked.assets?.length) return
    setImportMode(null)
    setBusy(true)
    setError('')
    try {
      const prepared: Array<{ fileName: string; absolutePath: string }> = []
      for (const asset of picked.assets) {
        const fileName = asset.name || 'import.bin'
        const absolutePath = await resolveMobileKnowledgeFilePath(asset.uri, fileName)
        prepared.push({ fileName, absolutePath })
      }
      const probed: KnowledgeExtractHint[] = []
      for (const item of prepared) {
        if (!item.fileName.toLowerCase().endsWith('.pdf')) continue
        try {
          const hint = await mobileProbeExtractHint({ absolutePath: item.absolutePath })
          if (hint.recommendVision) {
            probed.push(hint)
          }
        } catch {
          /* 探测失败不拦导入 */
        }
      }
      const hinted = collectVisionExtractHints(probed)
      if (hinted.length > 0) {
        setBusy(false)
        const choice = await askExtractHint({
          fileNames: hinted.map((row) => row.fileName),
          reason: pickVisionExtractHintReason(hinted),
          visionConfigured: hinted.some((row) => row.visionConfigured),
          visionModelId: hinted.find((row) => row.visionModelId)?.visionModelId
        })
        if (choice === 'cancel') return
        setBusy(true)
        setError('')
      }
      setBusy(false)
      const processChoice = await askImportProcess({
        fileNames: prepared.map((item) => item.fileName),
        extractEngineLabel: extractEngineShortLabel('vision', t)
      })
      if (!processChoice) return
      setBusy(true)
      setError('')
      for (const item of prepared) {
        const localId = `${item.absolutePath}:${Date.now()}`
        setUploadingSources((prev) => [
          ...prev,
          { localId, fileName: item.fileName, status: 'importing' }
        ])
        try {
          await mobileImportSource({
            notebookId,
            title: item.fileName,
            kind: 'file',
            absolutePath: item.absolutePath,
            fileName: item.fileName,
            importProcessMode: processChoice,
            extractEngine: 'vision'
          })
          setUploadingSources((prev) => prev.filter((row) => row.localId !== localId))
        } catch (e) {
          setUploadingSources((prev) =>
            prev.map((row) =>
              row.localId === localId
                ? { ...row, status: 'failed', error: String((e as Error)?.message || e) }
                : row
            )
          )
          throw e
        }
      }
      await refreshDetail()
      toast.showSuccess(
        shouldDeferKnowledgeImportOrganize(processChoice)
          ? t('knowledge.import_stored', '已保存为待整理')
          : t('knowledge.import_queued', '已加入整理队列')
      )
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
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
    extractHintPrompt,
    importProcessPrompt,
    settleExtractHint,
    settleImportProcess,
    openAddSource,
    uploadingSources,
    dismissUploading: (localId: string) =>
      setUploadingSources((prev) => prev.filter((row) => row.localId !== localId)),
    onImportText,
    onImportUrl,
    onImportFile
  }
}
