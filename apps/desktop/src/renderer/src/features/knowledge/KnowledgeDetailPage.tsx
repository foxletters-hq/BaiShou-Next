import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ArrowUp,
  File,
  FileCode,
  FileText,
  Link2,
  NotebookPen,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Cloud,
  ChevronDown,
  X
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Select, ModelSwitcherPopup, HelpTooltip, Switch, getProviderIcon, useTheme } from '@baishou/ui'
import { isEmbeddingModel, isTtsModel, isVisionModel } from '@baishou/shared'
import { useSettingsStore } from '@baishou/store'
import { KnowledgeShell } from './KnowledgeShell'
import { KnowledgeDialog } from './KnowledgeDialog'
import {
  KnowledgeSourcePreviewDialog,
  type SourcePreviewPayload
} from './KnowledgeSourcePreviewDialog'
import { callKnowledgeApi } from './call-knowledge-api'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import styles from './KnowledgePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

type SourceRow = {
  id: string
  title: string
  sourceKind: string
  status: string
  errorMessage?: string | null
  pageCount?: number | null
  textPageCount?: number | null
  originUrl?: string | null
  extractEngine?: string | null
}

type Citation = {
  sourceId: string
  title: string
  chunkId: string
  chunkIndex: number
  excerpt: string
  offset?: number
  len?: number
  page?: number
}

type ImportMode = 'chooser' | 'file' | 'text' | 'url' | null

type EngineCapSlot = {
  available: boolean
  reason?: string
  detail?: string
}

type EngineCaps = {
  simple: EngineCapSlot
  ocr: EngineCapSlot
  vision: EngineCapSlot
}

const OCR_LANGUAGE_PRESETS = [
  { value: 'chi_sim+eng', labelKey: 'knowledge.ocr_lang_chi_sim_eng' },
  { value: 'chi_tra+eng', labelKey: 'knowledge.ocr_lang_chi_tra_eng' },
  { value: 'eng', labelKey: 'knowledge.ocr_lang_eng' },
  { value: 'jpn+eng', labelKey: 'knowledge.ocr_lang_jpn_eng' }
] as const

function statusLabel(t: (key: string, fallback: string) => string, status: string): string {
  switch (status) {
    case 'pending':
      return t('knowledge.status_pending', '等待中')
    case 'extracting':
      return t('knowledge.status_extracting', '提取中')
    case 'needs_ocr':
      return t('knowledge.status_needs_ocr', '需 OCR')
    case 'partial':
      return t('knowledge.status_partial', '部分文本')
    case 'embedding':
      return t('knowledge.status_embedding', '索引中')
    case 'ready':
      return t('knowledge.status_ready', '就绪')
    case 'failed':
      return t('knowledge.status_failed', '失败')
    default:
      return status
  }
}

type OcrProgressState = {
  page: number
  total: number
  phase?: string
}

type UploadingSource = {
  localId: string
  fileName: string
  fileSize: number
  progress: number
  error?: string
}

function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() || name
  const idx = base.lastIndexOf('.')
  if (idx <= 0 || idx === base.length - 1) return ''
  return base.slice(idx + 1).toLowerCase()
}

function sourceFileIcon(kind: string, fileName: string, size = 18): React.ReactNode {
  if (kind === 'url') return <Link2 size={size} className={`${styles.fileTypeIcon} ${styles.iconUrl}`} />
  if (kind === 'note') {
    return <NotebookPen size={size} className={`${styles.fileTypeIcon} ${styles.iconNote}`} />
  }
  if (kind === 'text') {
    return <FileText size={size} className={`${styles.fileTypeIcon} ${styles.iconText}`} />
  }
  const ext = fileExtension(fileName)
  if (ext === 'pdf') {
    return <FileText size={size} className={`${styles.fileTypeIcon} ${styles.iconPdf}`} />
  }
  if (['md', 'markdown', 'txt'].includes(ext)) {
    return <FileCode size={size} className={`${styles.fileTypeIcon} ${styles.iconText}`} />
  }
  if (['json', 'js', 'ts', 'tsx', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
    return <FileCode size={size} className={`${styles.fileTypeIcon} ${styles.iconCode}`} />
  }
  return <File size={size} className={styles.fileTypeIcon} />
}

function ingestProgressPercent(status: string): number | null {
  switch (status) {
    case 'pending':
      return 18
    case 'extracting':
      return 48
    case 'embedding':
      return 78
    default:
      return null
  }
}

export const KnowledgeDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { notebookId = '' } = useParams<{ notebookId: string }>()
  const { setFolderRoot } = useOutletContext<WorkspaceOutletContext>()

  const [notebookName, setNotebookName] = useState('')
  const [storageLine, setStorageLine] = useState('')
  const [sources, setSources] = useState<SourceRow[]>([])
  const [question, setQuestion] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [subQueries, setSubQueries] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>(null)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewPayload, setPreviewPayload] = useState<SourcePreviewPayload | null>(null)
  const [ocrProgressBySource, setOcrProgressBySource] = useState<Record<string, OcrProgressState>>(
    {}
  )
  const [multiQuery, setMultiQuery] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showVisionModelPicker, setShowVisionModelPicker] = useState(false)
  const [engine, setEngine] = useState<'simple' | 'ocr' | 'vision'>('simple')
  const [ocrLanguage, setOcrLanguage] = useState('chi_sim+eng')
  const [ocrUseCustom, setOcrUseCustom] = useState(false)
  const [ocrConcurrency, setOcrConcurrency] = useState(1)
  const [visionProviderId, setVisionProviderId] = useState<string | null>(null)
  const [visionModelId, setVisionModelId] = useState<string | null>(null)
  const [engineCaps, setEngineCaps] = useState<EngineCaps | null>(null)
  const [uploadingSources, setUploadingSources] = useState<UploadingSource[]>([])
  const providers = useSettingsStore((s) => s.providers)
  const globalModels = useSettingsStore((s) => s.globalModels)
  const { isDark } = useTheme()

  const visionDisplay = useMemo(() => {
    const providerId = visionProviderId || globalModels?.globalDialogueProviderId || ''
    const modelId = visionModelId || globalModels?.globalDialogueModelId || ''
    const provider = providers.find((p) => p.id === providerId)
    const iconSrc =
      (providerId ? getProviderIcon(providerId, isDark) : undefined) ||
      (provider?.type ? getProviderIcon(provider.type, isDark) : undefined)
    return {
      isCustom: Boolean(visionProviderId && visionModelId),
      providerId,
      modelId,
      iconSrc
    }
  }, [visionProviderId, visionModelId, globalModels, providers, isDark])

  const notes = useMemo(() => sources.filter((s) => s.sourceKind === 'note'), [sources])
  const materials = useMemo(() => sources.filter((s) => s.sourceKind !== 'note'), [sources])

  const ocrPresetValue = ocrUseCustom
    ? '__custom__'
    : OCR_LANGUAGE_PRESETS.some((p) => p.value === ocrLanguage)
      ? ocrLanguage
      : '__custom__'

  const refresh = useCallback(async () => {
    if (!notebookId) return
    const notebooks = (await window.api.knowledge.listNotebooks()) as Array<{
      id: string
      name: string
    }>
    const nb = notebooks.find((n) => n.id === notebookId)
    setNotebookName(nb?.name || notebookId)
    const list = (await window.api.knowledge.listSources(notebookId)) as SourceRow[]
    setSources(list || [])
    setOcrProgressBySource((prev) => {
      const next = { ...prev }
      let changed = false
      for (const sourceId of Object.keys(next)) {
        const row = list?.find((s) => s.id === sourceId)
        if (
          row &&
          row.status !== 'pending' &&
          row.status !== 'extracting' &&
          row.status !== 'embedding'
        ) {
          delete next[sourceId]
          changed = true
        }
      }
      return changed ? next : prev
    })
    try {
      const stats = await window.api.knowledge.getStats(notebookId)
      const total = ((stats.totalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      const original = ((stats.originalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      setStorageLine(
        t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
          total,
          original
        })
      )
    } catch {
      setStorageLine('')
    }
  }, [notebookId, t])

  const refreshCaps = useCallback(async () => {
    try {
      const [caps, cfg] = await Promise.all([
        window.api.knowledge.getCapabilities(),
        window.api.knowledge.getConfig()
      ])
      if (cfg.defaultExtractEngine) setEngine(cfg.defaultExtractEngine)
      if (cfg.ocrLanguage) {
        setOcrLanguage(cfg.ocrLanguage)
        setOcrUseCustom(!OCR_LANGUAGE_PRESETS.some((p) => p.value === cfg.ocrLanguage))
      }
      if (typeof cfg.ocrConcurrency === 'number' && cfg.ocrConcurrency >= 1) {
        setOcrConcurrency(Math.max(1, Math.min(3, Math.floor(cfg.ocrConcurrency))))
      }
      if (typeof cfg.multiQueryAsk === 'boolean') setMultiQuery(cfg.multiQueryAsk)
      setVisionProviderId(cfg.visionProviderId ?? null)
      setVisionModelId(cfg.visionModelId ?? null)
      setEngineCaps({
        simple: { available: !!caps.simple?.available, reason: caps.simple?.reason },
        ocr: {
          available: !!caps.ocr?.available,
          reason: caps.ocr?.reason
        },
        vision: {
          available: !!caps.vision?.available,
          reason: caps.vision?.reason,
          detail: caps.vision?.detail
        }
      })
    } catch {
      setEngineCaps(null)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await callKnowledgeApi('recoverStale', 'knowledge:recover-stale')
      } catch {
        /* ignore */
      }
      void refresh().catch((e) => setError(String(e?.message || e)))
      void refreshCaps()
    })()
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [refresh, refreshCaps])

  useEffect(() => {
    const unsubscribe = window.api.knowledge.onOcrProgress?.((progress) => {
      if (progress.total <= 0) {
        setOcrProgressBySource((prev) => {
          if (!prev[progress.sourceId]) return prev
          const next = { ...prev }
          delete next[progress.sourceId]
          return next
        })
        void refresh().catch(() => undefined)
        return
      }
      setOcrProgressBySource((prev) => ({
        ...prev,
        [progress.sourceId]: {
          page: progress.page,
          total: progress.total,
          phase: progress.phase
        }
      }))
      if (progress.page >= progress.total && progress.total > 0) {
        void refresh().catch(() => undefined)
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [refresh])

  const onAsk = async () => {
    const q = question.trim()
    if (!q || !notebookId) return
    setBusy(true)
    setError('')
    setSubQueries([])
    setStatus(t('knowledge.asking', '正在检索并生成回答…'))
    try {
      const mismatch = await window.api.knowledge.hasModelMismatch?.()
      if (mismatch) throw new Error('knowledge-model-mismatch')

      const result = await window.api.knowledge.ask({
        notebookId,
        question: q,
        multiQuery
      })
      setLastQuestion(q)
      setAnswer(result.answer)
      setCitations(result.citations || [])
      setSubQueries(result.subQueries || [])
      setQuestion('')
      setStatus('')
    } catch (e: any) {
      const msg = String(e?.message || e)
      if (msg === 'knowledge-model-mismatch') {
        setError(
          t(
            'knowledge.model_mismatch_hard_block',
            '嵌入模型与知识库向量不一致，提问已拦截。请先「重建索引」。'
          )
        )
      } else {
        setError(msg)
      }
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const onSaveNote = async () => {
    if (!notebookId || !answer.trim() || !lastQuestion.trim()) return
    setBusy(true)
    try {
      await window.api.knowledge.saveNote({
        notebookId,
        question: lastQuestion.trim(),
        answer: answer.trim(),
        citations: citations.map((c) => ({
          title: c.title,
          page: c.page,
          excerpt: c.excerpt
        }))
      })
      await refresh()
      setStatus(t('knowledge.note_saved', '已保存为笔记，并加入索引队列'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onOcrMissing = async (sourceId: string) => {
    setError('')
    try {
      await window.api.knowledge.ocrMissingPages({
        sourceId,
        engine: engine === 'simple' ? 'ocr' : engine
      })
      setOcrProgressBySource((prev) => ({
        ...prev,
        [sourceId]: prev[sourceId] ?? { page: 0, total: 0 }
      }))
      setStatus(t('knowledge.ocr_queued', '已加入 OCR 队列'))
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    }
  }

  const onCancelExtract = async (sourceId: string) => {
    setError('')
    try {
      await callKnowledgeApi('cancelExtract', 'knowledge:cancel-extract', sourceId)
      setOcrProgressBySource((prev) => {
        if (!prev[sourceId]) return prev
        const next = { ...prev }
        delete next[sourceId]
        return next
      })
      setStatus(t('knowledge.extract_cancelled', '已取消提取'))
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    }
  }

  const onSaveSettings = async () => {
    setBusy(true)
    try {
      await window.api.knowledge.setConfig({
        defaultExtractEngine: engine,
        ocrLanguage,
        ocrConcurrency,
        multiQueryAsk: multiQuery,
        visionProviderId,
        visionModelId
      })
      await refreshCaps()
      setShowSettings(false)
      setStatus(t('knowledge.settings_saved', '知识库设置已保存'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportFile = async () => {
    if (!notebookId) return
    setError('')
    try {
      const files = await window.api.pickFiles({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Documents', extensions: ['pdf', 'md', 'txt', 'markdown'] }]
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

      let imported = 0
      for (const item of pending) {
        const tick = window.setInterval(() => {
          setUploadingSources((prev) =>
            prev.map((row) => {
              if (row.localId !== item.localId || row.progress >= 90 || row.error) return row
              const step = Math.max(2, Math.round(100 / Math.max(8, (row.fileSize || 1) / (256 * 1024))))
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
            extractEngine: engine
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
        setStatus(t('knowledge.import_queued', '已加入摄入队列'))
      }
    } catch (e: any) {
      setError(String(e?.message || e))
    }
  }

  const onImportText = async () => {
    if (!notebookId || !pasteText.trim()) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.importSource({
        notebookId,
        title: pasteTitle.trim() || t('knowledge.pasted_text', '粘贴文本'),
        kind: 'text',
        textContent: pasteText
      })
      setImportMode(null)
      setPasteTitle('')
      setPasteText('')
      await refresh()
      setStatus(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportUrl = async () => {
    const originUrl = urlValue.trim()
    if (!notebookId || !originUrl) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.importSource({
        notebookId,
        title: '',
        kind: 'url',
        originUrl
      })
      setImportMode(null)
      setUrlValue('')
      await refresh()
      setStatus(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onRetry = async (sourceId: string) => {
    setBusy(true)
    try {
      await window.api.knowledge.retrySource(sourceId)
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onRebuild = async () => {
    if (!notebookId) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.rebuildIndex(notebookId)
      await refresh()
      setStatus(t('knowledge.rebuild_queued', '已开始重建本机索引（不产生同步流量）'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onPreview = async (source: SourceRow) => {
    setPreviewOpen(true)
    setPreviewTitle(source.title)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewPayload(null)
    try {
      const result = await callKnowledgeApi<SourcePreviewPayload>(
        'getSourceFile',
        'knowledge:get-source-file',
        { sourceId: source.id }
      )
      setPreviewPayload(result)
    } catch (e: any) {
      setPreviewError(String(e?.message || e))
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setPreviewOpen(false)
    setPreviewPayload(null)
    setPreviewError(null)
    setPreviewLoading(false)
  }

  const dismissUploadError = (localId: string) => {
    setUploadingSources((prev) => prev.filter((row) => row.localId !== localId))
  }

  const renderUploadingItem = (item: UploadingSource) => {
    const failed = Boolean(item.error)
    return (
      <li key={item.localId} className={styles.sourceRow}>
        <div className={styles.sourceRowMain}>
          <span className={styles.sourceKindIcon} aria-hidden>
            {sourceFileIcon('file', item.fileName)}
          </span>
          <div className={styles.sourceRowBody}>
            <span className={styles.sourceTitle}>{item.fileName}</span>
            <span className={styles.sourceStatus}>
              {failed
                ? t('knowledge.status_upload_failed', '上传失败')
                : t('knowledge.status_uploading', '上传中 {{progress}}%', {
                    progress: Math.round(item.progress)
                  })}
            </span>
            {failed ? <span className={styles.sourceEvidence}>{item.error}</span> : null}
            <div
              className={`${styles.sourceProgressTrack}${failed ? ` ${styles.sourceProgressFailed}` : ''}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress)}
            >
              <div
                className={styles.sourceProgressFill}
                style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
              />
            </div>
          </div>
        </div>
        {failed ? (
          <div className={styles.sourceActions}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => dismissUploadError(item.localId)}
            >
              {t('knowledge.dismiss_upload', '关闭')}
            </button>
          </div>
        ) : null}
      </li>
    )
  }

  const renderSourceItem = (source: SourceRow) => {
    const missingPages =
      source.pageCount != null &&
      source.textPageCount != null &&
      source.pageCount > source.textPageCount
        ? source.pageCount - source.textPageCount
        : null
    const needsOcrBtn = source.status === 'needs_ocr' || source.status === 'partial'
    const ocrProgress = ocrProgressBySource[source.id]
    const isOcrEngine = source.extractEngine === 'ocr' || source.extractEngine === 'vision'
    // 仅 OCR/提取中可取消；普通导入 pending / embedding 不显示取消，避免误标 needs_ocr
    const canCancelExtract =
      Boolean(ocrProgress) ||
      source.status === 'extracting' ||
      (source.status === 'pending' && isOcrEngine)
    const ocrRunning = canCancelExtract
    const statusText =
      ocrProgress && ocrProgress.total > 0
        ? t('knowledge.status_ocr_progress', 'OCR 中 {{page}}/{{total}}', {
            page: ocrProgress.page,
            total: ocrProgress.total
          })
        : ocrProgress
          ? t('knowledge.status_extracting', '提取中')
          : statusLabel(t, source.status)
    const progress =
      ocrProgress && ocrProgress.total > 0
        ? Math.max(2, Math.round((Math.max(ocrProgress.page, 0) / ocrProgress.total) * 100))
        : ocrProgress
          ? 8
          : ingestProgressPercent(source.status)
    return (
      <li key={source.id} className={styles.sourceRow}>
        <div className={styles.sourceRowMain}>
          <span className={styles.sourceKindIcon} aria-hidden>
            {sourceFileIcon(source.sourceKind, source.title)}
          </span>
          <div className={styles.sourceRowBody}>
            <span className={styles.sourceTitle}>{source.title}</span>
            <span className={styles.sourceStatus}>{statusText}</span>
            {progress != null ? (
              <div
                className={`${styles.sourceProgressTrack} ${styles.sourceProgressIndeterminate}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div className={styles.sourceProgressFill} style={{ width: `${progress}%` }} />
              </div>
            ) : null}
            {missingPages != null && missingPages > 0 && !ocrProgress ? (
              <span className={styles.sourceEvidence}>
                {t('knowledge.scan_evidence', '{{total}} 页中 {{missing}} 页无文本层', {
                  total: source.pageCount,
                  missing: missingPages
                })}
              </span>
            ) : null}
            {source.errorMessage && !ocrProgress ? (
              <span className={styles.sourceEvidence}>{source.errorMessage}</span>
            ) : null}
          </div>
        </div>
        <div className={styles.sourceActions}>
          <button type="button" className={styles.linkBtn} onClick={() => void onPreview(source)}>
            {t('knowledge.preview_source', '预览')}
          </button>
          {canCancelExtract ? (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => void onCancelExtract(source.id)}
            >
              {t('knowledge.cancel_extract', '取消')}
            </button>
          ) : null}
          {needsOcrBtn ? (
            <button
              type="button"
              className={styles.linkBtn}
              disabled={busy || ocrRunning}
              onClick={() => void onOcrMissing(source.id)}
            >
              {t('knowledge.ocr_missing_pages', '只 OCR 缺失页')}
            </button>
          ) : null}
          {source.status === 'failed' || source.status === 'needs_ocr' ? (
            <button
              type="button"
              className={styles.linkBtn}
              disabled={busy || ocrRunning}
              onClick={() => void onRetry(source.id)}
            >
              {t('knowledge.retry', '重试')}
            </button>
          ) : null}
        </div>
      </li>
    )
  }

  const renderCapRow = (label: string, slot: EngineCapSlot | undefined) => {
    if (!slot) return null
    const ok = slot.available
    const note = ok ? slot.detail : slot.reason
    return (
      <div className={styles.capRow}>
        <span className={styles.capLabel}>{label}</span>
        <span className={ok ? styles.capOk : styles.capBad}>
          {ok ? t('knowledge.cap_available', '可用') : t('knowledge.cap_unavailable', '不可用')}
        </span>
        {note ? <span className={styles.capNote}>{note}</span> : null}
      </div>
    )
  }

  const hasConversation = Boolean(answer || lastQuestion)

  return (
    <KnowledgeShell setFolderRoot={setFolderRoot} mainClassName={styles.mainFill}>
      <motion.div
        className={styles.detailWorkspace}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <header className={styles.detailTopBar}>
          <div className={styles.detailTopLeft}>
            <button
              type="button"
              className={styles.iconGhostBtn}
              onClick={() => navigate('/agent-workspace/knowledge')}
              title={t('knowledge.back_to_list', '返回知识库')}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className={styles.detailTitle}>{notebookName || t('knowledge.title', '知识库')}</h1>
          </div>
          <div className={styles.detailTopRight}>
            <button
              type="button"
              className={styles.iconGhostBtn}
              onClick={() => setShowSettings(true)}
              disabled={busy}
              title={t('knowledge.settings', '知识库设置')}
            >
              <Settings size={17} />
            </button>
            <button
              type="button"
              className={styles.iconGhostBtn}
              onClick={() => void onRebuild()}
              disabled={busy}
              title={t('knowledge.rebuild_index', '重建索引')}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {status ? <p className={styles.bannerStatus}>{status}</p> : null}
        {error ? <p className={styles.bannerError}>{error}</p> : null}

        <div className={styles.detailTriLayout}>
          <section className={styles.detailColumn} aria-label={t('knowledge.sources_panel', '来源')}>
            <div className={styles.columnHead}>
              <h2 className={styles.columnTitle}>{t('knowledge.sources_panel', '来源')}</h2>
            </div>
            <button
              type="button"
              className={styles.addSourceBtn}
              onClick={() => setImportMode('chooser')}
              disabled={busy}
            >
              <Plus size={16} />
              {t('knowledge.add_source', '添加来源')}
            </button>
            {materials.length === 0 && uploadingSources.length === 0 ? (
              <div className={styles.columnEmpty}>
                {t('knowledge.empty_sources', '还没有资料，先导入 PDF / Markdown / URL。')}
              </div>
            ) : (
              <ul className={styles.sourceList}>
                {uploadingSources.map(renderUploadingItem)}
                {materials.map(renderSourceItem)}
              </ul>
            )}
          </section>

          <section
            className={`${styles.detailColumn} ${styles.conversationColumn}`}
            aria-label={t('knowledge.conversation_panel', '对话')}
          >
            <div className={styles.columnHead}>
              <h2 className={styles.columnTitle}>
                <Sparkles size={14} aria-hidden />
                {t('knowledge.conversation_panel', '对话')}
              </h2>
            </div>

            <div className={styles.chatScroll}>
              {!hasConversation ? (
                <div className={styles.chatEmpty}>
                  <p className={styles.chatEmptyTitle}>
                    {t('knowledge.ask_empty', '开始向这本笔记本提问吧。')}
                  </p>
                  <p className={styles.chatEmptyHint}>
                    {t(
                      'knowledge.conversation_hint',
                      '根据来源提问，回答会附带可追溯的引用。'
                    )}
                  </p>
                </div>
              ) : (
                <div className={styles.chatThread}>
                  {lastQuestion ? (
                    <div className={styles.userBubble}>
                      <p>{lastQuestion}</p>
                    </div>
                  ) : null}
                  <div className={styles.assistantCard}>
                    <div className={styles.assistantBody}>
                      {answer || (busy ? t('knowledge.asking', '正在检索并生成回答…') : '')}
                    </div>
                    {answer ? (
                      <div className={styles.assistantActions}>
                        <button
                          type="button"
                          className={styles.pillBtn}
                          disabled={busy}
                          onClick={() => void onSaveNote()}
                        >
                          <Save size={14} />
                          {t('knowledge.save_note', '保存为笔记')}
                        </button>
                      </div>
                    ) : null}
                    {subQueries.length > 0 ? (
                      <p className={styles.subQueryLine}>
                        {t('knowledge.sub_queries', '子查询')}：{subQueries.join(' · ')}
                      </p>
                    ) : null}
                    {citations.length > 0 ? (
                      <div className={styles.citations}>
                        <h3 className={styles.citationsTitle}>
                          {t('knowledge.citations', '引用')}
                        </h3>
                        {citations.map((c, i) => (
                          <div key={c.chunkId || `${c.sourceId}-${i}`} className={styles.citation}>
                            <div className={styles.citationTitle}>
                              [{i + 1}] {c.title}
                            </div>
                            <div className={styles.citationMeta}>
                              {c.page != null
                                ? t('knowledge.citation_page', '第 {{page}} 页', { page: c.page })
                                : c.offset != null
                                  ? t('knowledge.citation_offset', '偏移 {{offset}}', {
                                      offset: c.offset
                                    })
                                  : t('knowledge.citation_chunk', '片段 #{{index}}', {
                                      index: c.chunkIndex
                                    })}
                            </div>
                            <div className={styles.citationExcerpt}>{c.excerpt}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.composerBar}>
              <textarea
                className={styles.composerInput}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('knowledge.ask_placeholder', '例如：这几篇里对齐的主要分歧是什么？')}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!busy && question.trim()) void onAsk()
                  }
                }}
              />
              <div className={styles.composerMeta}>
                <span className={styles.composerSources}>
                  {t('knowledge.sources_count', '{{count}} 个来源', { count: materials.length })}
                </span>
                <button
                  type="button"
                  className={styles.sendBtn}
                  disabled={busy || !question.trim()}
                  onClick={() => void onAsk()}
                  aria-label={t('knowledge.ask_submit', '提问')}
                >
                  <ArrowUp size={18} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </section>

          <section className={styles.detailColumn} aria-label={t('knowledge.studio_panel', '工作室')}>
            <div className={styles.columnHead}>
              <h2 className={styles.columnTitle}>{t('knowledge.studio_panel', '工作室')}</h2>
            </div>

            <div className={styles.studioGrid}>
              <button
                type="button"
                className={`${styles.studioTile} ${styles.studioTileSky}`}
                disabled={busy || !answer}
                onClick={() => void onSaveNote()}
              >
                <Save size={18} />
                <span>{t('knowledge.studio_save_note', '保存笔记')}</span>
              </button>
              <button
                type="button"
                className={`${styles.studioTile} ${styles.studioTileLemon}`}
                disabled={busy}
                onClick={() => void onRebuild()}
              >
                <RefreshCw size={18} />
                <span>{t('knowledge.studio_rebuild', '重建索引')}</span>
              </button>
              <button
                type="button"
                className={`${styles.studioTile} ${styles.studioTileMint}`}
                disabled={busy}
                onClick={() => setShowSettings(true)}
              >
                <Settings size={18} />
                <span>{t('knowledge.studio_settings', '设置')}</span>
              </button>
              <button
                type="button"
                className={`${styles.studioTile} ${styles.studioTileRose}`}
                disabled={busy}
                onClick={() => setImportMode('text')}
              >
                <NotebookPen size={18} />
                <span>{t('knowledge.add_note', '添加笔记')}</span>
              </button>
            </div>

            <div className={styles.studioNotesHead}>
              <h3 className={styles.studioNotesTitle}>{t('knowledge.notes_panel', '笔记')}</h3>
            </div>
            {notes.length === 0 ? (
              <div className={styles.columnEmptyCompact}>
                {t('knowledge.empty_notes', '还没有笔记，可把回答保存到这里。')}
              </div>
            ) : (
              <ul className={styles.studioNoteList}>
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      className={styles.studioNoteItem}
                      onClick={() => void onPreview(note)}
                    >
                      <span className={styles.studioNoteIcon} aria-hidden>
                        📝
                      </span>
                      <span className={styles.studioNoteBody}>
                        <span className={styles.studioNoteTitle}>{note.title}</span>
                        <span className={styles.studioNoteMeta}>{statusLabel(t, note.status)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className={styles.studioFab}
              disabled={busy}
              onClick={() => setImportMode('text')}
            >
              <Plus size={16} />
              {t('knowledge.add_note', '添加笔记')}
            </button>
          </section>
        </div>
      </motion.div>

      <KnowledgeDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        closeDisabled={busy}
        title={t('knowledge.settings', '知识库设置')}
        aria-label={t('knowledge.settings', '知识库设置')}
        className={styles.dialogSettings}
      >
        <div className={styles.settingsStack}>
          <div className={styles.settingsGroup}>
            <div className={styles.sectionLabelRow}>
              <h3 className={styles.sectionLabel}>
                {t('knowledge.settings_section_extract', '导入提取')}
              </h3>
              <HelpTooltip
                size={14}
                content={t(
                  'knowledge.settings_section_extract_help',
                  '导入 PDF / 扫描件时如何抽出文字。普通电子 PDF 用文字层；扫描件用本地 OCR；复杂排版可用视觉模型。'
                )}
              />
            </div>
            <section className={styles.settingsCard}>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowText}>
                  <div className={styles.settingsRowTitle}>
                    {t('knowledge.default_engine', '默认提取方式')}
                    <HelpTooltip
                      size={14}
                      content={t(
                        'knowledge.default_engine_hint',
                        '普通电子 PDF 用文字层即可；扫描件优先本地 OCR；复杂版式或图表可改用视觉模型。'
                      )}
                    />
                  </div>
                </div>
                <Select
                  className={styles.settingsControl}
                  size="small"
                  value={engine}
                  options={[
                    {
                      value: 'simple',
                      label: t('knowledge.engine_simple_short', 'PDF 文字层')
                    },
                    {
                      value: 'ocr',
                      label: t('knowledge.engine_ocr_short', '本地 OCR')
                    },
                    {
                      value: 'vision',
                      label: t('knowledge.engine_vision_short', '视觉模型')
                    }
                  ]}
                  onChange={(e) => setEngine(e.target.value as 'simple' | 'ocr' | 'vision')}
                  aria-label={t('knowledge.default_engine', '默认提取方式')}
                />
              </div>
              <div className={styles.settingsDivider} />
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowText}>
                  <div className={styles.settingsRowTitle}>
                    {t('knowledge.ocr_language', 'OCR 语言')}
                    <HelpTooltip
                      size={14}
                      content={t(
                        'knowledge.ocr_language_hint',
                        '仅本地 OCR 使用。未安装对应语言包时，会自动降级为英文。'
                      )}
                    />
                  </div>
                </div>
                <Select
                  className={styles.settingsControl}
                  size="small"
                  value={ocrPresetValue}
                  options={[
                    ...OCR_LANGUAGE_PRESETS.map((p) => ({
                      value: p.value,
                      label: t(
                        p.labelKey,
                        p.value === 'chi_sim+eng'
                          ? '简体中文 + 英文'
                          : p.value === 'chi_tra+eng'
                            ? '繁体中文 + 英文'
                            : p.value === 'jpn+eng'
                              ? '日文 + 英文'
                              : '英文'
                      )
                    })),
                    { value: '__custom__', label: t('knowledge.ocr_lang_custom', '自定义…') }
                  ]}
                  onChange={(e) => {
                    const next = e.target.value
                    if (next === '__custom__') {
                      setOcrUseCustom(true)
                      return
                    }
                    setOcrUseCustom(false)
                    setOcrLanguage(next)
                  }}
                  aria-label={t('knowledge.ocr_language', 'OCR 语言')}
                />
              </div>
              {ocrPresetValue === '__custom__' ? (
                <>
                  <div className={styles.settingsDivider} />
                  <div className={styles.settingsRow}>
                    <input
                      className={styles.fieldInput}
                      value={ocrLanguage}
                      onChange={(e) => {
                        setOcrUseCustom(true)
                        setOcrLanguage(e.target.value)
                      }}
                      placeholder="chi_sim+eng"
                      spellCheck={false}
                    />
                  </div>
                </>
              ) : null}
              <div className={styles.settingsDivider} />
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowText}>
                  <div className={styles.settingsRowTitle}>
                    {t('knowledge.ocr_concurrency', 'OCR 并发')}
                    <HelpTooltip
                      size={14}
                      content={t(
                        'knowledge.ocr_concurrency_hint',
                        '同时处理的页数。1 最稳；2–3 更快但更占内存与 CPU。'
                      )}
                    />
                  </div>
                </div>
                <Select
                  className={styles.settingsControl}
                  size="small"
                  value={String(ocrConcurrency)}
                  options={[
                    { value: '1', label: t('knowledge.ocr_concurrency_1', '1 页（推荐）') },
                    { value: '2', label: t('knowledge.ocr_concurrency_2', '2 页') },
                    { value: '3', label: t('knowledge.ocr_concurrency_3', '3 页') }
                  ]}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    setOcrConcurrency(Number.isFinite(next) ? Math.max(1, Math.min(3, next)) : 1)
                  }}
                  aria-label={t('knowledge.ocr_concurrency', 'OCR 并发')}
                />
              </div>
              <div className={styles.settingsDivider} />
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowText}>
                  <div className={styles.settingsRowTitle}>
                    {t('knowledge.vision_model', '视觉模型')}
                    <HelpTooltip
                      size={14}
                      content={t(
                        'knowledge.vision_model_hint',
                        '选带看图能力的模型即可。扫描件抽字不必用最贵的，便宜的多模态模型通常够用。未指定时跟随全局对话模型。'
                      )}
                    />
                  </div>
                </div>
                <div className={styles.modelSelectorWrap}>
                  <button
                    type="button"
                    className={styles.modelSelectorBtn}
                    onClick={() => setShowVisionModelPicker(true)}
                    aria-label={t('knowledge.vision_model_pick', '选择')}
                  >
                    <span className={styles.modelSelectorIcon} aria-hidden>
                      {visionDisplay.iconSrc ? (
                        <img src={visionDisplay.iconSrc} alt="" />
                      ) : (
                        <Cloud size={16} />
                      )}
                    </span>
                    <span className={styles.modelSelectorName}>
                      {visionDisplay.isCustom
                        ? visionDisplay.modelId
                        : visionDisplay.modelId
                          ? t('knowledge.vision_model_follow_named', '跟随 · {{model}}', {
                              model: visionDisplay.modelId
                            })
                          : t('knowledge.vision_model_unset_short', '跟随全局对话模型')}
                    </span>
                    <ChevronDown size={14} className={styles.modelSelectorChevron} aria-hidden />
                  </button>
                  {visionDisplay.isCustom ? (
                    <button
                      type="button"
                      className={styles.modelSelectorClear}
                      onClick={() => {
                        setVisionProviderId(null)
                        setVisionModelId(null)
                      }}
                      aria-label={t('knowledge.vision_model_clear_short', '清除')}
                      title={t('knowledge.vision_model_clear_short', '清除')}
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <div className={styles.settingsGroup}>
            <div className={styles.sectionLabelRow}>
              <h3 className={styles.sectionLabel}>
                {t('knowledge.settings_section_ask', '提问检索')}
              </h3>
              <HelpTooltip
                size={14}
                content={t(
                  'knowledge.settings_section_ask_help',
                  '控制提问时是否把复杂问题拆开分别检索后再合并。'
                )}
              />
            </div>
            <section className={styles.settingsCard}>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowText}>
                  <div className={styles.settingsRowTitle}>
                    {t('knowledge.multi_query', '复杂问题拆分检索')}
                    <HelpTooltip
                      size={14}
                      content={t(
                        'knowledge.multi_query_hint',
                        '默认关闭。开启后，遇到「A 和 B」这类问题会拆成最多 2 条分别搜索再合并，覆盖更全，但稍慢、多耗一点嵌入次数。'
                      )}
                    />
                  </div>
                </div>
                <Switch
                  size="sm"
                  checked={multiQuery}
                  onChange={(e) => setMultiQuery(e.target.checked)}
                  aria-label={t('knowledge.multi_query', '复杂问题拆分检索')}
                />
              </div>
            </section>
          </div>

          <div className={styles.settingsGroup}>
            <div className={styles.sectionLabelRow}>
              <h3 className={styles.sectionLabel}>{t('knowledge.engine_caps', '当前能力')}</h3>
            </div>
            <section className={styles.settingsCard}>
              <div className={styles.capBlockCompact}>
                {engineCaps ? (
                  <>
                    {renderCapRow(t('knowledge.cap_simple', 'PDF 文字层'), engineCaps.simple)}
                    {renderCapRow(t('knowledge.cap_ocr', '本地 OCR'), engineCaps.ocr)}
                    {renderCapRow(t('knowledge.cap_vision', '视觉模型'), engineCaps.vision)}
                  </>
                ) : (
                  <p className={styles.metaLine}>—</p>
                )}
                {storageLine ? <p className={styles.metaLine}>{storageLine}</p> : null}
              </div>
            </section>
          </div>
        </div>

        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setShowSettings(false)}
            disabled={busy}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onSaveSettings()}
            disabled={busy}
          >
            {t('common.save', '保存')}
          </button>
        </div>
      </KnowledgeDialog>

      {showVisionModelPicker ? (
        <ModelSwitcherPopup
          onClose={() => setShowVisionModelPicker(false)}
          providers={providers
            .map((p) => {
              const modelList =
                p.enabledModels && p.enabledModels.length > 0 ? p.enabledModels : p.models || []
              const filteredModels = modelList.filter(
                (m) =>
                  !isEmbeddingModel(m) && !isTtsModel(m) && isVisionModel(m, p.type || p.id)
              )
              return {
                id: p.id,
                name: p.name || p.id,
                type: p.type || 'custom',
                models: p.models || [],
                enabledModels: filteredModels
              }
            })
            .filter((p) => p.enabledModels.length > 0)}
          currentProviderId={visionProviderId ?? undefined}
          currentModelId={visionModelId ?? undefined}
          onSelect={(pid, mid) => {
            setVisionProviderId(pid)
            setVisionModelId(mid)
            setShowVisionModelPicker(false)
          }}
          onManageProviders={() => {
            setShowVisionModelPicker(false)
            navigate(`${SETTINGS_HUB_PREFIX}/ai-models`)
          }}
        />
      ) : null}

      <KnowledgeDialog
        open={importMode === 'chooser'}
        onClose={() => setImportMode(null)}
        closeDisabled={busy}
        title={t('knowledge.add_source', '添加来源')}
        aria-label={t('knowledge.add_source', '添加来源')}
      >
        <div className={styles.chooserGrid}>
          <button
            type="button"
            className={styles.chooserItem}
            disabled={busy}
            onClick={() => setImportMode('file')}
          >
            <FileText size={20} />
            <span>{t('knowledge.import_file', '导入文件')}</span>
          </button>
          <button
            type="button"
            className={styles.chooserItem}
            disabled={busy}
            onClick={() => setImportMode('text')}
          >
            <NotebookPen size={20} />
            <span>{t('knowledge.import_text', '粘贴文本')}</span>
          </button>
          <button
            type="button"
            className={styles.chooserItem}
            disabled={busy}
            onClick={() => setImportMode('url')}
          >
            <Link2 size={20} />
            <span>{t('knowledge.import_url', '导入 URL')}</span>
          </button>
        </div>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setImportMode(null)}
            disabled={busy}
          >
            {t('common.cancel', '取消')}
          </button>
        </div>
      </KnowledgeDialog>

      <KnowledgeDialog
        open={importMode === 'file'}
        onClose={() => setImportMode(null)}
        closeDisabled={busy}
        title={t('knowledge.import_file', '导入文件')}
        aria-label={t('knowledge.import_file', '导入文件')}
      >
        <p className={styles.metaLine}>
          {t('knowledge.import_file_hint', '支持 PDF（文本层）、Markdown、纯文本。')}
        </p>
        <p className={styles.metaLine}>
          {t('knowledge.import_engine_hint', '将使用当前默认引擎')}：{engine}
        </p>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setImportMode(null)}
            disabled={busy}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onImportFile()}
            disabled={busy}
          >
            {t('knowledge.choose_files', '选择文件')}
          </button>
        </div>
      </KnowledgeDialog>

      <KnowledgeDialog
        open={importMode === 'text'}
        onClose={() => setImportMode(null)}
        closeDisabled={busy}
        title={t('knowledge.import_text', '粘贴文本')}
        aria-label={t('knowledge.import_text', '粘贴文本')}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('knowledge.source_title', '标题')}</span>
          <input
            className={styles.fieldInput}
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('knowledge.source_body', '正文')}</span>
          <textarea
            className={styles.fieldTextarea}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
        </label>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setImportMode(null)}
            disabled={busy}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onImportText()}
            disabled={busy || !pasteText.trim()}
          >
            {t('knowledge.import_submit', '导入')}
          </button>
        </div>
      </KnowledgeDialog>

      <KnowledgeDialog
        open={importMode === 'url'}
        onClose={() => setImportMode(null)}
        closeDisabled={busy}
        title={t('knowledge.import_url', '导入 URL')}
        aria-label={t('knowledge.import_url', '导入 URL')}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>URL</span>
          <input
            className={styles.fieldInput}
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://"
            autoFocus
          />
        </label>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setImportMode(null)}
            disabled={busy}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onImportUrl()}
            disabled={busy || !urlValue.trim()}
          >
            {t('knowledge.import_submit', '导入')}
          </button>
        </div>
      </KnowledgeDialog>

      <KnowledgeSourcePreviewDialog
        open={previewOpen}
        onClose={closePreview}
        title={
          previewTitle
            ? `${t('knowledge.preview_source_title', '源文件预览')} · ${previewTitle}`
            : t('knowledge.preview_source_title', '源文件预览')
        }
        loading={previewLoading}
        error={previewError}
        payload={previewPayload}
      />
    </KnowledgeShell>
  )
}
