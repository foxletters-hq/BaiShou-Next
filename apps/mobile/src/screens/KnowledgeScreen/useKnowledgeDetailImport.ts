import { useCallback, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import {
  collectVisionExtractHints,
  pickVisionExtractHintReason,
  shouldDeferKnowledgeImportOrganize,
  type KnowledgeExtractHint,
  type KnowledgeExtractHintChoice,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'
import * as DocumentPicker from 'expo-document-picker'
import {
  mobileImportSource,
  resolveMobileKnowledgeFilePath
} from '@/src/services/mobile-knowledge.service'
import { mobileProbeExtractHint } from '@/src/services/mobile-knowledge-preview.service'

export function useKnowledgeDetailImport(input: {
  notebookId: string
  engine: 'ocr' | 'vision'
  importProcessMode: KnowledgeImportProcessMode
  t: TFunction
  toast: ReturnType<typeof useNativeToast>
  setBusy: (busy: boolean) => void
  setError: (message: string) => void
  refreshDetail: () => Promise<void>
}) {
  const { notebookId, engine, importProcessMode, t, toast, setBusy, setError, refreshDetail } =
    input
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [showImport, setShowImport] = useState<'text' | 'url' | null>(null)
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

  const settleExtractHint = useCallback((choice: KnowledgeExtractHintChoice) => {
    const resolve = extractHintResolver.current
    extractHintResolver.current = null
    setExtractHintPrompt(null)
    resolve?.(choice)
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

  const onImportText = async () => {
    if (!pasteText.trim()) return
    setBusy(true)
    setError('')
    try {
      await mobileImportSource({
        notebookId,
        title: pasteTitle.trim() || t('knowledge.pasted_text', '粘贴文本'),
        kind: 'text',
        textContent: pasteText,
        importProcessMode
      })
      setPasteTitle('')
      setPasteText('')
      setShowImport(null)
      await refreshDetail()
      toast.showSuccess(
        shouldDeferKnowledgeImportOrganize(importProcessMode)
          ? t('knowledge.import_stored', '已保存为待整理')
          : t('knowledge.import_queued', '已加入摄入队列')
      )
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportUrl = async () => {
    const originUrl = urlValue.trim()
    if (!originUrl) return
    setBusy(true)
    setError('')
    try {
      await mobileImportSource({
        notebookId,
        title: '',
        kind: 'url',
        originUrl,
        importProcessMode
      })
      setUrlValue('')
      setShowImport(null)
      await refreshDetail()
      toast.showSuccess(
        shouldDeferKnowledgeImportOrganize(importProcessMode)
          ? t('knowledge.import_stored', '已保存为待整理')
          : t('knowledge.import_queued', '已加入摄入队列')
      )
    } catch (e) {
      setError(String((e as Error)?.message || e))
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
    setBusy(true)
    setError('')
    try {
      const prepared: Array<{ fileName: string; absolutePath: string }> = []
      for (const asset of picked.assets) {
        const fileName = asset.name || 'import.bin'
        const absolutePath = await resolveMobileKnowledgeFilePath(asset.uri, fileName)
        prepared.push({ fileName, absolutePath })
      }
      const hintedPaths = new Set<string>()
      let hintedEngine: 'ocr' | 'vision' = engine
      if (engine !== 'vision') {
        const probed: KnowledgeExtractHint[] = []
        for (const item of prepared) {
          if (!item.fileName.toLowerCase().endsWith('.pdf')) continue
          try {
            const hint = await mobileProbeExtractHint({ absolutePath: item.absolutePath })
            if (hint.recommendVision) {
              probed.push(hint)
              hintedPaths.add(item.absolutePath)
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
          if (choice === 'vision') hintedEngine = 'vision'
          else if (choice === 'ocr') hintedEngine = 'ocr'
          setBusy(true)
          setError('')
        }
      }
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
            importProcessMode,
            extractEngine: hintedPaths.has(item.absolutePath) ? hintedEngine : engine
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
        shouldDeferKnowledgeImportOrganize(importProcessMode)
          ? t('knowledge.import_stored', '已保存为待整理')
          : t('knowledge.import_queued', '已加入摄入队列')
      )
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return {
    pasteTitle,
    setPasteTitle,
    pasteText,
    setPasteText,
    urlValue,
    setUrlValue,
    showImport,
    setShowImport,
    extractHintPrompt,
    settleExtractHint,
    uploadingSources,
    dismissUploading: (localId: string) =>
      setUploadingSources((prev) => prev.filter((row) => row.localId !== localId)),
    onImportText,
    onImportUrl,
    onImportFile
  }
}
