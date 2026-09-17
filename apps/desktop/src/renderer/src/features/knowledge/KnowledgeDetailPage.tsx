import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  File,
  FileCode,
  FileText,
  Link2,
  NotebookPen,
  Plus,
  Cloud,
  ChevronDown,
  MoreHorizontal,
  X
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  AnchoredContextMenu,
  Button,
  Input,
  Select,
  HelpTooltip,
  Tooltip,
  getProviderIcon,
  toast,
  useTheme,
  type ContextMenuItem
} from '@baishou/ui'
import {
  clampOcrConcurrency,
  collectNotebookGraphSourceWindows,
  DEFAULT_OCR_CONCURRENCY,
  RECOMMENDED_OCR_CONCURRENCY,
  listOcrConcurrencyValues,
  normalizeKnowledgeDefaultExtractEngine,
  normalizeKnowledgeImportProcessMode,
  resolveGlobalGraphModelIds,
  resolveReasoningEffortForSlot,
  type KnowledgeExtractHint,
  type KnowledgeExtractHintChoice,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { useSettingsStore } from '@baishou/store'
import { KnowledgeShell } from './KnowledgeShell'
import { KnowledgeDialog } from './KnowledgeDialog'
import { KnowledgeSourceFragmentDialog } from './KnowledgeSourceFragmentDialog'
import {
  KnowledgeSourcePreviewDialog,
  type SourcePreviewPayload
} from './KnowledgeSourcePreviewDialog'
import {
  buildGraphFragmentItems,
  buildVectorFragmentItem,
  type KnowledgeSourceFragment
} from './knowledge-source-fragment.util'
import { callKnowledgeApi } from './call-knowledge-api'
import { KnowledgeNotebookTabBar } from './KnowledgeNotebookTabBar'
import { KnowledgeVectorPane, type KnowledgeVectorChunkCard } from './KnowledgeVectorPane'
import { NotebookStatusPanel } from './NotebookStatusPanel'
import {
  NotebookDataManageDialog,
  type NotebookDataManageConfirm
} from './NotebookDataManageDialog'
import {
  notebookDataManageFeedback,
  notebookDataManageStatusKind,
  notebookDataManageWatch,
  parseNotebookDataManageResult,
  type NotebookDataManageResult
} from './notebook-data-manage.util'
import { NotebookGraphPane } from './NotebookGraphPane'
import type { NotebookGraphViewEdge } from './notebook-graph-view.util'
import { KnowledgeHeavyConfirmDialog } from './KnowledgeHeavyConfirmDialog'
import type { KnowledgeHeavyConfirmKind } from './KnowledgeHeavyConfirmDialog'
import { KnowledgeExtractHintDialog } from './KnowledgeExtractHintDialog'
import { KnowledgeImportProcessDialog } from './KnowledgeImportProcessDialog'
import { KnowledgeExtractProbeSection } from './KnowledgeExtractProbeSection'
import { KnowledgeModelMenu } from './KnowledgeModelMenu'
import { useNotebookStatusModels } from './useNotebookStatusModels'
import {
  buildKnowledgeSourceMenuActions,
  type KnowledgeSourceMenuAction
} from './knowledge-source-menu.util'
import { collectVisionExtractHints, pickVisionExtractHintReason } from './extract-engine-hint.util'
import { knowledgeExtractSettingsVisibility } from './knowledge-extract-settings-visibility.util'
import { buildNotebookOpenGuideRows } from './notebook-open-guide.util'
import { resolveNotebookProviderIconSrc } from './notebook-status-icon.util'
import {
  formatNotebookGraphProgress,
  notebookGraphProgressCopy
} from './notebook-graph-progress.util'
import { notebookJobProgressCopy } from './notebook-job-progress.util'
import {
  pickSourceCardEvidence,
  sourceCardFailureReason,
  sourceMissingPageCount
} from './source-card-evidence.util'
import { knowledgeIngestUserMessage } from './knowledge-ingest-user-error.util'
import { knowledgeSourceShowsPendingOrganizeHelp } from './knowledge-source-status.util'
import type { KnowledgeNotebookTab } from './knowledge-notebook-tab.util'
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
  relativePath?: string | null
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
      return t('knowledge.status_pending', '等待整理')
    case 'extracting':
      return t('knowledge.status_extracting', '正在提取文本')
    case 'needs_ocr':
      return t('knowledge.status_needs_ocr', '需 OCR')
    case 'partial':
      return t('knowledge.status_partial', '部分文本')
    case 'embedding':
      return t('knowledge.status_embedding', '正在建立索引')
    case 'ready':
      return t('knowledge.status_ready', '就绪')
    case 'failed':
      return t('knowledge.status_failed', '失败')
    case 'stored':
      return t('knowledge.status_stored', '待整理')
    default:
      return status
  }
}

function extractEngineShortLabel(
  t: (key: string, fallback: string) => string,
  engine: 'simple' | 'ocr' | 'vision'
): string {
  if (engine === 'ocr') return t('knowledge.engine_ocr_short', '本地 OCR')
  if (engine === 'vision') return t('knowledge.engine_vision_short', '视觉模型')
  return t('knowledge.engine_simple_short', 'PDF 文字层')
}

function sourceMenuLabel(
  t: (key: string, fallback: string) => string,
  action: KnowledgeSourceMenuAction
): string {
  switch (action) {
    case 'preview':
      return t('knowledge.preview_source', '预览')
    case 'embed':
      return t('knowledge.embed_source', '嵌入')
    case 'reembed':
      return t('knowledge.reembed_source', '重新嵌入')
    case 'reembed-vector':
      return t('knowledge.reembed_vector', '向量')
    case 'reembed-graph':
      return t('knowledge.reembed_graph', '图数据')
    case 'delete':
      return t('knowledge.delete_source', '删除')
    case 'cancel':
      return t('knowledge.cancel_extract', '取消')
    case 'retry':
      return t('knowledge.retry', '重试')
    case 'ocr':
      return t('knowledge.ocr_missing_pages', '只 OCR 缺失页')
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
  if (kind === 'url')
    return <Link2 size={size} className={`${styles.fileTypeIcon} ${styles.iconUrl}`} />
  if (kind === 'note' || kind === 'text') {
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

export const KnowledgeDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { notebookId = '' } = useParams<{ notebookId: string }>()
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>()
  const setFolderRoot = outlet?.setFolderRoot ?? (() => undefined)

  const [notebookName, setNotebookName] = useState('')
  const [storageLine, setStorageLine] = useState('')
  const [chunkCount, setChunkCount] = useState(0)
  const [activeTab, setActiveTab] = useState<KnowledgeNotebookTab>('sources')
  const [sources, setSources] = useState<SourceRow[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [heavyConfirmKind, setHeavyConfirmKind] = useState<KnowledgeHeavyConfirmKind | null>(null)
  const [heavyConfirmSource, setHeavyConfirmSource] = useState<SourceRow | null>(null)
  const [graphBusy, setGraphBusy] = useState(false)
  const [graphJobs, setGraphJobs] = useState<{
    pending: number
    running: number
    failed: number
    currentSourceId: string | null
    currentSourceTitle: string | null
  }>({
    pending: 0,
    running: 0,
    failed: 0,
    currentSourceId: null,
    currentSourceTitle: null
  })
  const [graphKnownTotal, setGraphKnownTotal] = useState(0)
  const [graphWindowProgress, setGraphWindowProgress] = useState<{
    done: number
    total: number
  } | null>(null)
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
  const [fragmentOpen, setFragmentOpen] = useState(false)
  const [fragmentLoading, setFragmentLoading] = useState(false)
  const [fragmentError, setFragmentError] = useState<string | null>(null)
  const [fragments, setFragments] = useState<KnowledgeSourceFragment[]>([])
  const [ocrProgressBySource, setOcrProgressBySource] = useState<Record<string, OcrProgressState>>(
    {}
  )
  const [showSettings, setShowSettings] = useState(false)
  const [dataManageOpen, setDataManageOpen] = useState(false)
  const [reprocessWatching, setReprocessWatching] = useState(false)
  const [vectorKnownTotal, setVectorKnownTotal] = useState(0)
  const reprocessSawWorkRef = useRef(false)
  const settingsWasOpenRef = useRef(false)
  const visionModelTriggerRef = useRef<HTMLButtonElement>(null)
  const [engine, setEngine] = useState<'simple' | 'ocr' | 'vision'>('ocr')
  const [ocrLanguage, setOcrLanguage] = useState('chi_sim+eng')
  const [ocrUseCustom, setOcrUseCustom] = useState(false)
  const [ocrConcurrency, setOcrConcurrency] = useState(DEFAULT_OCR_CONCURRENCY)
  const refreshGen = useRef(0)
  const [pendingJobs, setPendingJobs] = useState(0)
  const ingestingSourceCount = sources.filter(
    (s) => s.status === 'pending' || s.status === 'extracting' || s.status === 'embedding'
  ).length
  const hasActiveIngest = pendingJobs > 0 || ingestingSourceCount > 0
  const vectorPending = ingestingSourceCount
  const [visionProviderId, setVisionProviderId] = useState<string | null>(null)
  const [visionModelId, setVisionModelId] = useState<string | null>(null)
  const [engineCaps, setEngineCaps] = useState<EngineCaps | null>(null)
  const [uploadingSources, setUploadingSources] = useState<UploadingSource[]>([])
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
  const [sourceMenu, setSourceMenu] = useState<{ sourceId: string; x: number; y: number } | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<SourceRow | null>(null)
  const providers = useSettingsStore((s) => s.providers)
  const globalModels = useSettingsStore((s) => s.globalModels)
  const { isDark } = useTheme()
  const {
    picker,
    closePicker,
    pickStatusRow,
    openVisionPicker,
    selectModel,
    persistReasoningSlot
  } = useNotebookStatusModels({
    engine,
    ocrLanguage,
    ocrConcurrency,
    setVisionProviderId,
    setVisionModelId,
    setShowSettings,
    onError: setError
  })

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
    async (input: { fileNames: string[]; extractEngineLabel: string }) => {
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
          fileNames: input.fileNames,
          extractEngineLabel: input.extractEngineLabel,
          embeddingModelLabel,
          graphModelLabel,
          defaultMode
        })
      })
    },
    [globalModels, t]
  )

  const closeSettings = useCallback(() => {
    closePicker()
    setShowSettings(false)
  }, [closePicker])

  const goBackToList = useCallback(() => {
    navigate('/agent-workspace/knowledge')
  }, [navigate])

  useEffect(() => {
    if (settingsWasOpenRef.current && !showSettings) closePicker()
    settingsWasOpenRef.current = showSettings
  }, [closePicker, showSettings])

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

  const refreshGraphJobs = useCallback(async () => {
    if (!notebookId) return
    try {
      const snap = await callKnowledgeApi<{
        pending: number
        running: number
        failed: number
        currentSourceId: string | null
        currentSourceTitle: string | null
      }>('listGraphJobs', 'knowledge:list-graph-jobs', notebookId)
      setGraphJobs(
        snap || {
          pending: 0,
          running: 0,
          failed: 0,
          currentSourceId: null,
          currentSourceTitle: null
        }
      )
      if ((snap?.pending || 0) > 0) {
        setGraphKnownTotal((prev) => Math.max(prev, snap.pending))
      }
      if ((snap?.pending || 0) === 0 && (snap?.running || 0) === 0) {
        setGraphWindowProgress(null)
      }
    } catch {
      /* 旧进程未注册通道时忽略，完全重启后即可 */
    }
  }, [notebookId])

  const graphProgress = useMemo(
    () =>
      formatNotebookGraphProgress(
        notebookGraphProgressCopy({
          pending: graphJobs.pending,
          running: graphJobs.running,
          failed: graphJobs.failed,
          currentSourceTitle: graphJobs.currentSourceTitle,
          knownTotal: graphKnownTotal,
          windowsDone: graphWindowProgress?.done,
          windowsTotal: graphWindowProgress?.total
        }),
        (key, params) => t(key, params)
      ),
    [graphJobs, graphKnownTotal, graphWindowProgress, t]
  )

  const jobProgress = useMemo(() => {
    const copy = notebookJobProgressCopy({
      vectorActive: vectorPending,
      vectorKnownTotal,
      graph: {
        pending: graphJobs.pending,
        running: graphJobs.running,
        failed: graphJobs.failed,
        currentSourceTitle: graphJobs.currentSourceTitle,
        knownTotal: graphKnownTotal,
        windowsDone: graphWindowProgress?.done,
        windowsTotal: graphWindowProgress?.total
      }
    })
    return {
      visible: copy.visible,
      vector: copy.vector
        ? {
            detail:
              copy.vector.detailKey === 'knowledge.job_vector_done_of'
                ? t(
                    'knowledge.job_vector_done_of',
                    '已完成 {{done}} / {{total}} 份资料',
                    copy.vector.detailParams
                  )
                : t(
                    'knowledge.job_vector_active',
                    '正在整理 {{count}} 份资料',
                    copy.vector.detailParams
                  ),
            percent: copy.vector.percent
          }
        : null,
      graph: copy.graph
        ? formatNotebookGraphProgress(copy.graph, (key, params) => t(key, params))
        : null
    }
  }, [graphJobs, graphKnownTotal, graphWindowProgress, t, vectorKnownTotal, vectorPending])

  const statusRows = useMemo(() => {
    const providerType = (providerId?: string | null) =>
      providers.find((row) => row.id === providerId)?.type || null
    const extract = resolveGlobalGraphModelIds(globalModels)
    const visionProvider = visionProviderId || globalModels?.globalDialogueProviderId || ''
    const embeddingProviderId = globalModels?.globalEmbeddingProviderId || ''
    return buildNotebookOpenGuideRows({
      embeddingModelId: globalModels?.globalEmbeddingModelId,
      graphModelId: extract.modelId,
      visionModelId: visionModelId || globalModels?.globalDialogueModelId,
      extractEngine: engine,
      sourceCount: sources.length,
      icons: {
        embedding: resolveNotebookProviderIconSrc({
          providerId: embeddingProviderId,
          providerType: providerType(embeddingProviderId),
          isDark
        }),
        graphExtract: resolveNotebookProviderIconSrc({
          providerId: extract.providerId,
          providerType: providerType(extract.providerId),
          isDark
        }),
        vision: resolveNotebookProviderIconSrc({
          providerId: visionProvider,
          providerType: providerType(visionProvider),
          isDark
        })
      }
    })
  }, [engine, globalModels, isDark, providers, sources.length, visionModelId, visionProviderId])

  const ocrPresetValue = ocrUseCustom
    ? '__custom__'
    : OCR_LANGUAGE_PRESETS.some((p) => p.value === ocrLanguage)
      ? ocrLanguage
      : '__custom__'
  const { showOcrSettings, showVisionSettings } = knowledgeExtractSettingsVisibility(engine)

  const refresh = useCallback(async () => {
    if (!notebookId) return
    const gen = ++refreshGen.current
    const [nb, list] = await Promise.all([
      window.api.knowledge.getNotebook(notebookId),
      window.api.knowledge.listSources(notebookId) as Promise<SourceRow[]>
    ])
    if (gen !== refreshGen.current) return
    setNotebookName(nb?.name || notebookId)
    setSources(list || [])
    setSourcesLoaded(true)
    const byId = new Map((list || []).map((s) => [s.id, s]))
    setOcrProgressBySource((prev) => {
      const next = { ...prev }
      let changed = false
      for (const sourceId of Object.keys(next)) {
        const row = byId.get(sourceId)
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
    void refreshGraphJobs()
    try {
      const stats = await window.api.knowledge.getStats(notebookId)
      if (gen !== refreshGen.current) return
      setPendingJobs(Number(stats.pendingJobs ?? 0))
      setChunkCount(Number(stats.chunks ?? 0))
      const total = ((stats.totalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      const original = ((stats.originalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      setStorageLine(
        t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
          total,
          original
        })
      )
    } catch {
      if (gen === refreshGen.current) {
        setStorageLine('')
        setChunkCount(0)
      }
    }
  }, [notebookId, refreshGraphJobs, t])

  const refreshCaps = useCallback(async () => {
    try {
      const [caps, cfg] = await Promise.all([
        window.api.knowledge.getCapabilities(),
        window.api.knowledge.getConfig()
      ])
      if (cfg.defaultExtractEngine) {
        setEngine(normalizeKnowledgeDefaultExtractEngine(cfg.defaultExtractEngine))
      }
      if (cfg.ocrLanguage) {
        setOcrLanguage(cfg.ocrLanguage)
        setOcrUseCustom(!OCR_LANGUAGE_PRESETS.some((p) => p.value === cfg.ocrLanguage))
      }
      if (typeof cfg.ocrConcurrency === 'number' && cfg.ocrConcurrency >= 1) {
        setOcrConcurrency(clampOcrConcurrency(cfg.ocrConcurrency))
      }
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
    setSourcesLoaded(false)
  }, [notebookId])

  useEffect(() => {
    void refresh().catch((e) => setError(String(e?.message || e)))
    void refreshCaps()
    void callKnowledgeApi('recoverStale', 'knowledge:recover-stale').catch(() => undefined)
  }, [refresh, refreshCaps])

  useEffect(() => {
    if (!hasActiveIngest && !reprocessWatching) return
    const timer = window.setInterval(
      () => {
        void refresh().catch(() => undefined)
      },
      reprocessWatching ? 1000 : 4000
    )
    return () => window.clearInterval(timer)
  }, [hasActiveIngest, refresh, reprocessWatching])

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

  useEffect(() => {
    void useSettingsStore.getState().ensureConfigKeys(['globalModels', 'providers'])
  }, [])

  useEffect(() => {
    const onProgress = (progress?: { windowsDone?: number; windowsTotal?: number }) => {
      if (typeof progress?.windowsTotal === 'number' && progress.windowsTotal > 0) {
        setGraphWindowProgress({
          done: Number(progress.windowsDone ?? 0),
          total: progress.windowsTotal
        })
      }
      void refreshGraphJobs()
      void refresh().catch(() => undefined)
    }
    const unsubscribe = window.api.knowledge.onGraphProgress?.(onProgress)
    let fallback: (() => void) | undefined
    if (!unsubscribe && typeof window.electron?.ipcRenderer?.on === 'function') {
      const handler = (
        _event: unknown,
        progress?: { windowsDone?: number; windowsTotal?: number }
      ) => onProgress(progress)
      const off = window.electron.ipcRenderer.on('knowledge:graph-progress', handler)
      fallback = typeof off === 'function' ? off : undefined
    }
    return () => {
      unsubscribe?.()
      fallback?.()
    }
  }, [refresh, refreshGraphJobs])

  useEffect(() => {
    if (graphJobs.pending <= 0 && graphJobs.running <= 0 && !graphBusy && !reprocessWatching) return
    const timer = window.setInterval(() => {
      void refreshGraphJobs()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [graphBusy, graphJobs.pending, graphJobs.running, refreshGraphJobs, reprocessWatching])

  useEffect(() => {
    if (!reprocessWatching) return
    const active = hasActiveIngest || graphJobs.pending > 0 || graphJobs.running > 0
    if (active) {
      reprocessSawWorkRef.current = true
      return
    }
    if (!reprocessSawWorkRef.current) return
    setReprocessWatching(false)
    setStatus(t('knowledge.data_manage_reprocess_done', '重新整理已完成'))
  }, [graphJobs.pending, graphJobs.running, hasActiveIngest, reprocessWatching, t])

  useEffect(() => {
    if (vectorPending > 0) {
      setVectorKnownTotal((prev) => Math.max(prev, vectorPending))
      return
    }
    if (!reprocessWatching && !hasActiveIngest) setVectorKnownTotal(0)
  }, [hasActiveIngest, reprocessWatching, vectorPending])

  const onOcrMissing = async (sourceId: string) => {
    setError('')
    try {
      let nextEngine: 'simple' | 'ocr' | 'vision' = engine === 'simple' ? 'ocr' : engine
      if (engine !== 'vision') {
        try {
          const hint = await window.api.knowledge.probeExtractHint({ sourceId })
          if (hint.recommendVision) {
            const choice = await askExtractHint({
              fileNames: [hint.fileName],
              reason: hint.reason,
              visionConfigured: hint.visionConfigured,
              visionModelId: hint.visionModelId
            })
            if (choice === 'cancel') return
            if (choice === 'vision') nextEngine = 'vision'
            else if (choice === 'ocr' || choice === 'keep') nextEngine = 'ocr'
          }
        } catch {
          /* 探测失败时仍按当前引擎补抽 */
        }
      }
      await window.api.knowledge.ocrMissingPages({
        sourceId,
        engine: nextEngine
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
        defaultExtractEngine: normalizeKnowledgeDefaultExtractEngine(engine),
        ocrLanguage,
        ocrConcurrency: clampOcrConcurrency(ocrConcurrency),
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

  const onEmbed = async (sourceId: string) => {
    setBusy(true)
    try {
      await callKnowledgeApi('retrySource', 'knowledge:retry-source', sourceId)
      await refresh()
      setStatus(t('knowledge.embed_queued', '已开始嵌入'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onReprocess = async (sourceId: string, target: 'embed' | 'graph') => {
    setBusy(true)
    try {
      if (target === 'graph') {
        const title = sources.find((row) => row.id === sourceId)?.title || null
        setGraphKnownTotal((prev) => Math.max(prev, 1))
        setGraphWindowProgress(null)
        setGraphJobs((prev) => ({
          pending: Math.max(prev.pending, 1),
          running: prev.running,
          failed: prev.failed,
          currentSourceId: sourceId,
          currentSourceTitle: title
        }))
        setActiveTab('graph')
      }
      await callKnowledgeApi('reprocessSource', 'knowledge:reprocess-source', {
        sourceId,
        target
      })
      await refresh()
      await refreshGraphJobs()
      setStatus(
        target === 'graph'
          ? t('knowledge.reembed_graph_queued', '已开始重新抽取图数据')
          : t('knowledge.reembed_vector_queued', '已开始重新嵌入向量')
      )
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onDeleteSource = async (sourceId: string) => {
    setBusy(true)
    setError('')
    try {
      await callKnowledgeApi('deleteSource', 'knowledge:delete-source', sourceId)
      setDeleteTarget(null)
      await refresh()
      setStatus(t('knowledge.source_deleted', '已删除资料'))
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

  const onManageNotebookData = async (input: NotebookDataManageConfirm) => {
    if (!notebookId) return
    setBusy(true)
    setError('')
    try {
      const raw = await callKnowledgeApi<NotebookDataManageResult>(
        'manageData',
        'knowledge:manage-data',
        {
          notebookId,
          action: input.action,
          vector: input.vector,
          graph: input.graph
        }
      )
      const result =
        parseNotebookDataManageResult(raw) ??
        ({
          action: input.action,
          vector: input.vector,
          graph: input.graph,
          sourceCount: sources.length,
          vectorQueued: input.action === 'reprocess' && input.vector ? sources.length : 0,
          graphQueued: input.action === 'reprocess' && input.graph ? sources.length : 0
        } satisfies NotebookDataManageResult)
      const kind = notebookDataManageStatusKind(result)
      const watch = notebookDataManageWatch(result)
      setDataManageOpen(false)
      if (watch.watch) {
        reprocessSawWorkRef.current = false
        setReprocessWatching(true)
        if (watch.vectorQueued > 0) {
          setPendingJobs((prev) => Math.max(prev, watch.vectorQueued))
          setVectorKnownTotal((prev) => Math.max(prev, watch.vectorQueued))
        }
        if (watch.graphQueued > 0) {
          setGraphKnownTotal((prev) => Math.max(prev, watch.graphQueued, sources.length))
          setGraphJobs((prev) => ({
            ...prev,
            pending: Math.max(prev.pending, watch.graphQueued)
          }))
          if (!input.vector) setActiveTab('graph')
        }
      } else {
        setReprocessWatching(false)
      }
      await refreshGraphJobs()
      await refresh()
      if (notebookDataManageFeedback(kind) === 'toast') {
        toast.showInfo(
          kind === 'reprocess-empty'
            ? t(
                'knowledge.data_manage_reprocess_empty',
                '这本笔记本还没有资料，没有可重新整理的数据'
              )
            : t(
                'knowledge.data_manage_reprocess_none',
                '没有可重新整理的数据。需要资料已完成文本提取后才能重建向量或图谱。'
              )
        )
        return
      }
      setStatus(
        kind === 'cleared'
          ? t('knowledge.data_manage_cleared', '已清除所选派生数据')
          : t(
              'knowledge.data_manage_reprocess_queued_counts',
              '已开始重新整理：向量 {{vector}} 项，图谱 {{graph}} 项',
              { vector: watch.vectorQueued, graph: watch.graphQueued }
            )
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onRebuildGraph = async () => {
    setGraphBusy(true)
    setError('')
    try {
      setGraphKnownTotal(Math.max(sources.length, 1))
      setActiveTab('graph')
      await callKnowledgeApi('rebuildGraph', 'knowledge:rebuild-graph', notebookId)
      await refreshGraphJobs()
      await refresh()
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setGraphBusy(false)
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

  const closeFragments = () => {
    setFragmentOpen(false)
    setFragments([])
    setFragmentError(null)
    setFragmentLoading(false)
  }

  const onPreviewGraphFragments = async (edges: NotebookGraphViewEdge[]) => {
    const windows = collectNotebookGraphSourceWindows(edges)
    setFragmentOpen(true)
    setFragmentError(null)
    if (windows.length === 0) {
      setFragments([])
      setFragmentLoading(false)
      return
    }
    setFragmentLoading(true)
    setFragments([])
    try {
      const result = await callKnowledgeApi<{
        items: Array<{
          sourceId: string
          sourceTitle: string
          windowIndex: number
          text: string | null
        }>
      }>('getExtractedWindows', 'knowledge:get-extracted-windows', {
        notebookId,
        windows: windows.map((row) => ({
          sourceId: row.sourceId,
          windowIndex: row.windowIndex
        }))
      })
      setFragments(buildGraphFragmentItems(windows, result.items || []))
    } catch (e: unknown) {
      setFragmentError(String((e as Error)?.message || e))
    } finally {
      setFragmentLoading(false)
    }
  }

  const onPreviewVectorFragment = (item: KnowledgeVectorChunkCard) => {
    setFragmentOpen(true)
    setFragmentLoading(false)
    setFragmentError(null)
    setFragments([buildVectorFragmentItem(item)])
  }

  const dismissUploadError = (localId: string) => {
    setUploadingSources((prev) => prev.filter((row) => row.localId !== localId))
  }

  const renderUploadingItem = (item: UploadingSource) => {
    const failed = Boolean(item.error)
    return (
      <li key={item.localId} className={styles.sourceCardItem}>
        <div className={`${styles.notebookCard} ${styles.sourceCard}`}>
          <div className={styles.notebookCardTop} />
          <div className={styles.notebookCardVisual}>
            <span className={styles.sourceCardIcon} aria-hidden>
              {sourceFileIcon('file', item.fileName, 28)}
            </span>
          </div>
          <div className={styles.notebookCardBody}>
            <h2 className={styles.notebookCardTitle}>{item.fileName}</h2>
            <p className={styles.notebookCardMeta}>
              {failed
                ? t('knowledge.status_upload_failed', '上传失败')
                : t('knowledge.status_uploading', '上传中 {{progress}}%', {
                    progress: Math.round(item.progress)
                  })}
            </p>
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
            {failed ? (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => dismissUploadError(item.localId)}
              >
                {t('knowledge.dismiss_upload', '关闭')}
              </button>
            ) : null}
          </div>
        </div>
      </li>
    )
  }

  const sourceMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!sourceMenu) return []
    const source = sources.find((row) => row.id === sourceMenu.sourceId)
    if (!source) return []
    const ocrProgress = ocrProgressBySource[source.id]
    const isOcrEngine = source.extractEngine === 'ocr' || source.extractEngine === 'vision'
    const ocrRunning =
      Boolean(ocrProgress) ||
      source.status === 'extracting' ||
      (source.status === 'pending' && isOcrEngine)
    const actions = buildKnowledgeSourceMenuActions({
      status: source.status,
      extractEngine: source.extractEngine,
      ocrRunning
    })
    const run = (action: KnowledgeSourceMenuAction) => {
      if (action === 'preview') void onPreview(source)
      else if (action === 'embed') {
        setHeavyConfirmSource(source)
        setHeavyConfirmKind('embed-source')
      } else if (action === 'reembed-vector') {
        setHeavyConfirmSource(source)
        setHeavyConfirmKind('reembed-vector')
      } else if (action === 'reembed-graph') {
        setHeavyConfirmSource(source)
        setHeavyConfirmKind('reembed-graph')
      } else if (action === 'delete') setDeleteTarget(source)
      else if (action === 'cancel') void onCancelExtract(source.id)
      else if (action === 'retry') void onRetry(source.id)
      else if (action === 'ocr') void onOcrMissing(source.id)
    }
    return actions.flatMap((action) => {
      const item: ContextMenuItem =
        action === 'reembed'
          ? {
              label: sourceMenuLabel(t, action),
              children: [
                {
                  label: sourceMenuLabel(t, 'reembed-vector'),
                  onClick: () => run('reembed-vector')
                },
                {
                  label: sourceMenuLabel(t, 'reembed-graph'),
                  onClick: () => run('reembed-graph')
                }
              ]
            }
          : {
              label: sourceMenuLabel(t, action),
              onClick: () => run(action)
            }
      return action === 'delete' ? [{ label: '', divider: true }, item] : [item]
    })
  }, [ocrProgressBySource, sourceMenu, sources, t])

  const renderSourceItem = (source: SourceRow) => {
    const missingPages = sourceMissingPageCount(source)
    const ocrProgress = ocrProgressBySource[source.id]
    const statusText =
      ocrProgress && ocrProgress.total > 0
        ? t('knowledge.status_ocr_progress', 'OCR 中 {{page}}/{{total}}', {
            page: ocrProgress.page,
            total: ocrProgress.total
          })
        : ocrProgress
          ? t('knowledge.status_extracting', '正在提取文本')
          : statusLabel(t, source.status)
    const pageProgress =
      ocrProgress && ocrProgress.total > 0
        ? Math.max(2, Math.round((Math.max(ocrProgress.page, 0) / ocrProgress.total) * 100))
        : null
    const evidence = pickSourceCardEvidence({
      pageCount: source.pageCount,
      missingPages,
      hideHints: Boolean(ocrProgress)
    })
    const failureReason = sourceCardFailureReason({
      status: source.status,
      errorMessage: source.errorMessage
    })
    const card = (
      <div
        className={`${styles.notebookCard} ${styles.sourceCard}`}
        role="button"
        tabIndex={0}
        aria-label={
          failureReason
            ? `${source.title} ${statusText}。${knowledgeIngestUserMessage(failureReason, t)}`
            : undefined
        }
        onClick={() => void onPreview(source)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void onPreview(source)
          }
        }}
      >
        <div className={styles.notebookCardTop}>
          <span aria-hidden />
          <button
            type="button"
            className={styles.notebookCardMenu}
            aria-label={t('knowledge.source_menu', '资料操作')}
            title={t('knowledge.source_menu', '资料操作')}
            onClick={(event) => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              setSourceMenu({ sourceId: source.id, x: rect.right, y: rect.bottom })
            }}
          >
            <MoreHorizontal size={16} strokeWidth={2} />
          </button>
        </div>
        <div className={styles.notebookCardVisual}>
          <span className={styles.sourceCardIcon} aria-hidden>
            {sourceFileIcon(source.sourceKind, source.title, 28)}
          </span>
        </div>
        <div className={styles.notebookCardBody}>
          <h2 className={styles.notebookCardTitle}>{source.title}</h2>
          <p
            className={
              knowledgeSourceShowsPendingOrganizeHelp(source.status)
                ? `${styles.notebookCardMeta} ${styles.sourceCardStatus}`
                : styles.notebookCardMeta
            }
          >
            <span>{statusText}</span>
            {knowledgeSourceShowsPendingOrganizeHelp(source.status) ? (
              <HelpTooltip
                content={t('knowledge.status_stored_help', '未整理之前，AI 无法使用这份资料。')}
              />
            ) : null}
          </p>
          {pageProgress != null ? (
            <div
              className={styles.sourceProgressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pageProgress}
            >
              <div className={styles.sourceProgressFill} style={{ width: `${pageProgress}%` }} />
            </div>
          ) : null}
          {evidence?.type === 'scan' ? (
            <span className={styles.sourceEvidence}>
              {t('knowledge.scan_evidence', '{{total}} 页中 {{missing}} 页无文本层', {
                total: evidence.pageCount,
                missing: evidence.missingPages
              })}
            </span>
          ) : null}
        </div>
      </div>
    )
    return (
      <li key={source.id} className={styles.sourceCardItem}>
        {failureReason ? (
          <Tooltip
            content={knowledgeIngestUserMessage(failureReason, t)}
            className={styles.sourceCardFailWrap}
            tooltipClassName={styles.sourceFailTooltip}
          >
            {card}
          </Tooltip>
        ) : (
          card
        )}
      </li>
    )
  }

  const renderSourcesColumn = () => (
    <section
      id="knowledge-sources-panel"
      className={styles.sourcesBody}
      aria-label={t('knowledge.sources_panel', '来源')}
    >
      <div className={styles.columnHead}>
        <h2 className={styles.columnTitle}>{t('knowledge.sources_panel', '来源')}</h2>
      </div>
      <ul className={`${styles.listGrid} ${styles.sourceGrid}`}>
        <li className={styles.sourceCardItem}>
          <button
            type="button"
            className={styles.createCard}
            onClick={openAddSource}
            disabled={busy}
          >
            <span className={styles.createCardIcon} aria-hidden>
              <Plus size={22} strokeWidth={2.25} />
            </span>
            <span className={styles.createCardLabel}>{t('knowledge.add_source', '添加来源')}</span>
          </button>
        </li>
        {uploadingSources.map(renderUploadingItem)}
        {sources.map(renderSourceItem)}
      </ul>
    </section>
  )

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
              onClick={goBackToList}
              title={t('knowledge.back_to_list', '返回知识库')}
              aria-label={t('knowledge.back_to_list', '返回知识库')}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className={styles.detailTitle}>{notebookName || t('knowledge.title', '知识库')}</h1>
          </div>
          <KnowledgeNotebookTabBar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className={styles.detailTopRight} />
        </header>

        {jobProgress.visible && activeTab !== 'graph' ? (
          <div className={styles.jobProgress}>
            {jobProgress.vector ? (
              <div className={styles.jobProgressRow}>
                <span className={styles.jobProgressLabel}>
                  {t('knowledge.job_vector_label', '向量整理')}
                </span>
                <div className={styles.jobProgressBody}>
                  <span className={styles.jobProgressDetail}>{jobProgress.vector.detail}</span>
                  {jobProgress.vector.percent != null ? (
                    <div
                      className={styles.jobProgressBar}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={jobProgress.vector.percent}
                    >
                      <div
                        className={styles.jobProgressFill}
                        style={{
                          width: `${Math.max(0, Math.min(100, jobProgress.vector.percent))}%`
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {jobProgress.graph ? (
              <div className={styles.jobProgressRow}>
                <span className={styles.jobProgressLabel}>
                  {t('knowledge.job_graph_label', '图谱抽取')}
                </span>
                <div className={styles.jobProgressBody}>
                  <span className={styles.jobProgressDetail}>
                    {[jobProgress.graph.headline, jobProgress.graph.detail]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <div
                    className={styles.jobProgressBar}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={jobProgress.graph.percent}
                  >
                    <div
                      className={styles.jobProgressFill}
                      style={{
                        width: `${Math.max(0, Math.min(100, jobProgress.graph.percent))}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {status && !jobProgress.visible ? <p className={styles.bannerStatus}>{status}</p> : null}
        {error ? (
          <p className={styles.bannerError}>{knowledgeIngestUserMessage(error, t)}</p>
        ) : null}

        {activeTab === 'sources' ? (
          <div className={styles.sourcesStage}>
            <NotebookStatusPanel
              rows={statusRows}
              busy={busy}
              onOpenSettings={() => {
                closePicker()
                setShowSettings(true)
              }}
              onOpenDataManage={() => setDataManageOpen(true)}
              onPickRow={pickStatusRow}
            />
            {renderSourcesColumn()}
          </div>
        ) : null}

        {activeTab === 'graph' ? (
          <NotebookGraphPane
            notebookId={notebookId}
            sourceCount={sources.length}
            progress={graphProgress}
            extracting={graphBusy || graphJobs.pending > 0 || graphJobs.running > 0}
            reloadKey={`${graphJobs.pending}:${graphJobs.running}:${graphJobs.failed}:${graphJobs.currentSourceTitle ?? ''}:${sources.length}:${graphWindowProgress?.done ?? 0}:${graphWindowProgress?.total ?? 0}`}
            onStartExtract={() => {
              setHeavyConfirmSource(null)
              setHeavyConfirmKind('rebuild-graph')
            }}
            onPreviewFragments={(edges) => void onPreviewGraphFragments(edges)}
          />
        ) : null}

        {activeTab === 'vectors' ? (
          <KnowledgeVectorPane
            notebookId={notebookId}
            sourceCount={sources.length}
            chunkCount={chunkCount}
            storageLine={storageLine}
            busy={busy}
            onPreviewFragment={onPreviewVectorFragment}
          />
        ) : null}
      </motion.div>

      <NotebookDataManageDialog
        open={dataManageOpen}
        busy={busy}
        onClose={() => setDataManageOpen(false)}
        onConfirm={onManageNotebookData}
      />

      <KnowledgeExtractHintDialog
        open={extractHintPrompt != null}
        fileNames={extractHintPrompt?.fileNames || []}
        reason={extractHintPrompt?.reason ?? null}
        currentEngine={extractHintPrompt?.currentEngine || engine}
        visionConfigured={Boolean(extractHintPrompt?.visionConfigured)}
        visionModelId={extractHintPrompt?.visionModelId}
        onCancel={() => settleExtractHint('cancel')}
        onChoose={settleExtractHint}
        onOpenVisionSettings={() => {
          settleExtractHint('cancel')
          setShowSettings(true)
        }}
      />

      <KnowledgeImportProcessDialog
        open={importProcessPrompt != null}
        prompt={importProcessPrompt}
        onCancel={() => settleImportProcess(null)}
        onConfirm={(mode) => settleImportProcess(mode)}
      />

      {sourceMenu ? (
        <AnchoredContextMenu
          x={sourceMenu.x}
          y={sourceMenu.y}
          items={sourceMenuItems}
          onClose={() => setSourceMenu(null)}
        />
      ) : null}

      <KnowledgeDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        closeDisabled={busy}
        title={t('knowledge.delete_source_title', '删除资料')}
        aria-label={t('knowledge.delete_source_title', '删除资料')}
      >
        <p className={styles.guideHint}>
          {t(
            'knowledge.delete_source_confirm',
            '将删除「{{title}}」的原文和提取结果，并清空这份资料对应的图关系和向量数据。此操作不能恢复。',
            { title: deleteTarget?.title || '' }
          )}
        </p>
        <div className={styles.extractHintActions}>
          <Button type="button" disabled={busy} onClick={() => setDeleteTarget(null)}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            type="button"
            disabled={busy || !deleteTarget}
            onClick={() => {
              if (deleteTarget) void onDeleteSource(deleteTarget.id)
            }}
          >
            {t('knowledge.delete_source', '删除')}
          </Button>
        </div>
      </KnowledgeDialog>

      <KnowledgeHeavyConfirmDialog
        open={heavyConfirmKind != null}
        kind={heavyConfirmKind}
        sourceTitle={heavyConfirmSource?.title}
        onCancel={() => {
          setHeavyConfirmKind(null)
          setHeavyConfirmSource(null)
        }}
        onConfirm={() => {
          const kind = heavyConfirmKind
          const source = heavyConfirmSource
          setHeavyConfirmKind(null)
          setHeavyConfirmSource(null)
          if (kind === 'rebuild-graph') void onRebuildGraph()
          else if (kind === 'rebuild-index') void onRebuild()
          else if (kind === 'embed-source' && source) void onEmbed(source.id)
          else if (kind === 'reembed-vector' && source) void onReprocess(source.id, 'embed')
          else if (kind === 'reembed-graph' && source) void onReprocess(source.id, 'graph')
        }}
      />

      <KnowledgeDialog
        open={showSettings}
        onClose={closeSettings}
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
                  '导入时先抽已有文字。缺页或乱码时，扫描件用本地 OCR，复杂排版可用视觉模型。'
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
                        '导入时先抽已有文字。缺页或乱码时，扫描件优先本地 OCR；复杂版式或图表可改用视觉模型。'
                      )}
                    />
                  </div>
                  {engineCaps?.[engine] && !engineCaps[engine].available ? (
                    <p className={`${styles.settingsRowHint} ${styles.settingsRowHintWarn}`}>
                      {engineCaps[engine].reason || t('knowledge.cap_unavailable', '不可用')}
                    </p>
                  ) : null}
                </div>
                <Select
                  className={styles.settingsControl}
                  size="small"
                  value={engine}
                  options={[
                    {
                      value: 'ocr',
                      label: t('knowledge.engine_ocr_short', '本地 OCR')
                    },
                    {
                      value: 'vision',
                      label: t('knowledge.engine_vision_short', '视觉模型')
                    }
                  ]}
                  onChange={(e) =>
                    setEngine(normalizeKnowledgeDefaultExtractEngine(e.target.value))
                  }
                  aria-label={t('knowledge.default_engine', '默认提取方式')}
                />
              </div>
              {showOcrSettings ? (
                <>
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
                        <Input
                          fieldSize="small"
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
                            '同时处理的页数，范围 1–10。推荐 3；1 最稳，调高更快，但更占内存与 CPU。'
                          )}
                        />
                      </div>
                    </div>
                    <Select
                      className={styles.settingsControl}
                      size="small"
                      value={String(ocrConcurrency)}
                      options={listOcrConcurrencyValues().map((n) => ({
                        value: String(n),
                        label:
                          n === RECOMMENDED_OCR_CONCURRENCY
                            ? t(
                                'knowledge.ocr_concurrency_option_recommended',
                                '{{count}} 页（推荐）',
                                {
                                  count: n
                                }
                              )
                            : t('knowledge.ocr_concurrency_option', '{{count}} 页', { count: n })
                      }))}
                      onChange={(e) => {
                        setOcrConcurrency(clampOcrConcurrency(Number(e.target.value)))
                      }}
                      aria-label={t('knowledge.ocr_concurrency', 'OCR 并发')}
                    />
                  </div>
                </>
              ) : null}
              {showVisionSettings ? (
                <>
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
                      <p className={`${styles.settingsRowHint} ${styles.settingsRowHintWrap}`}>
                        {t(
                          'knowledge.vision_model_recommend',
                          '推荐选带看图能力的便宜多模态模型，扫描件抽字不必用最贵的。'
                        )}
                      </p>
                    </div>
                    <div className={styles.modelSelectorWrap}>
                      <button
                        ref={visionModelTriggerRef}
                        type="button"
                        className={styles.modelSelectorBtn}
                        onClick={() => {
                          openVisionPicker(
                            visionModelTriggerRef.current?.getBoundingClientRect() ?? null
                          )
                        }}
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
                        <ChevronDown
                          size={14}
                          className={styles.modelSelectorChevron}
                          aria-hidden
                        />
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
                </>
              ) : null}
            </section>
          </div>
          <KnowledgeExtractProbeSection
            notebookId={notebookId}
            sources={sources}
            engine={engine === 'vision' ? 'vision' : 'ocr'}
            engineAvailable={Boolean(
              engineCaps?.[engine === 'vision' ? 'vision' : 'ocr']?.available
            )}
            engineUnavailableReason={engineCaps?.[engine === 'vision' ? 'vision' : 'ocr']?.reason}
            disabled={busy}
            ocrLanguage={ocrLanguage}
            ocrConcurrency={ocrConcurrency}
            visionProviderId={visionProviderId || globalModels?.globalDialogueProviderId || null}
            visionModelId={visionModelId || globalModels?.globalDialogueModelId || null}
          />
        </div>

        <div className={styles.dialogActions}>
          <Button type="button" onClick={closeSettings} disabled={busy}>
            {t('common.cancel', '取消')}
          </Button>
          <Button type="button" onClick={() => void onSaveSettings()} disabled={busy}>
            {t('common.save', '保存')}
          </Button>
        </div>
      </KnowledgeDialog>

      {picker ? (
        <KnowledgeModelMenu
          kind={picker.kind}
          providers={providers}
          currentProviderId={
            picker.field === 'embedding'
              ? globalModels?.globalEmbeddingProviderId
              : picker.field === 'graph'
                ? globalModels?.globalGraphProviderId
                : (visionProviderId ?? undefined)
          }
          currentModelId={
            picker.field === 'embedding'
              ? globalModels?.globalEmbeddingModelId
              : picker.field === 'graph'
                ? globalModels?.globalGraphModelId
                : (visionModelId ?? undefined)
          }
          anchorRect={picker.anchor}
          onSelect={(providerId, modelId) => {
            void selectModel(providerId, modelId)
          }}
          onClose={closePicker}
          reasoningEffort={
            picker.field === 'graph'
              ? resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'graph')
              : picker.field === 'vision'
                ? resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'vision')
                : 'auto'
          }
          onReasoningEffortChange={(value) => {
            if (picker.field === 'graph') void persistReasoningSlot('graph', value)
            if (picker.field === 'vision') void persistReasoningSlot('vision', value)
          }}
          onManageProviders={() => {
            closeSettings()
            navigate(`${SETTINGS_HUB_PREFIX}/ai-services`)
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
          <Button type="button" onClick={() => setImportMode(null)} disabled={busy}>
            {t('common.cancel', '取消')}
          </Button>
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
          {t(
            'knowledge.import_file_hint',
            '支持 PDF、EPUB、Markdown、纯文本。扫描件或没有文字层的 PDF 可以用本地 OCR。'
          )}
        </p>
        <p className={styles.metaLine}>
          {t('knowledge.import_engine_hint', '提取方式按知识库设置：{{engine}}', {
            engine: extractEngineShortLabel(t, engine)
          })}
        </p>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={() => setImportMode(null)} disabled={busy}>
            {t('common.cancel', '取消')}
          </Button>
          <Button type="button" onClick={() => void onImportFile()} disabled={busy}>
            {t('knowledge.choose_files', '选择文件')}
          </Button>
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
          <Input
            fieldSize="small"
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
          <Button type="button" onClick={() => setImportMode(null)} disabled={busy}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            type="button"
            onClick={() => void onImportText()}
            disabled={busy || !pasteText.trim()}
          >
            {t('knowledge.import_submit', '导入')}
          </Button>
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
          <Input
            fieldSize="small"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://"
            autoFocus
          />
        </label>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={() => setImportMode(null)} disabled={busy}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            type="button"
            onClick={() => void onImportUrl()}
            disabled={busy || !urlValue.trim()}
          >
            {t('knowledge.import_submit', '导入')}
          </Button>
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
      <KnowledgeSourceFragmentDialog
        open={fragmentOpen}
        loading={fragmentLoading}
        error={fragmentError}
        fragments={fragments}
        onClose={closeFragments}
      />
    </KnowledgeShell>
  )
}
