import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import {
  canConfirmNotebookDataManage,
  clampOcrConcurrency,
  DEFAULT_OCR_CONCURRENCY,
  normalizeKnowledgeDefaultExtractEngine,
  notebookDataManageStatusKind,
  parseNotebookDataManageResult,
  shouldDeferKnowledgeImportOrganize,
  type GraphSimilarPendingPair,
  type KnowledgeImportProcessMode,
  type NotebookDataManageAction
} from '@baishou/shared'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import {
  mobileCancelExtract,
  mobileDeleteNotebook,
  mobileDeleteSource,
  mobileEmbedSource,
  mobileGetExtractedPreview,
  mobileGetKnowledgeConfig,
  mobileGetKnowledgeStats,
  mobileGetNotebook,
  mobileGetNotebookGraphView,
  mobileHasKnowledgeModelMismatch,
  mobileImportSource,
  mobileListKnowledgeChunks,
  mobileListNotebookGraphJobs,
  mobileListSources,
  mobileManageNotebookData,
  mobileOcrMissingPages,
  mobileOrganizeNotebook,
  mobileRebuildKnowledgeIndex,
  mobileRebuildNotebookGraph,
  mobileRecoverStaleIngest,
  mobileReprocessSource,
  mobileResolveNotebookCoverUri,
  mobileRetrySource,
  mobileSearchNotebookGraphNodes,
  mobileSetKnowledgeConfig,
  resolveMobileActiveVaultId,
  resolveMobileKnowledgeFilePath,
  mobileSetCoverImage,
  mobileUpdateNotebook,
  subscribeMobileKnowledgeExtractProgress
} from '@/src/services/mobile-knowledge.service'
import {
  mobileDismissNotebookSimilarPair,
  mobileListNotebookSimilarPendingPairs,
  mobileMergeNotebookGraphNodes,
  mobileReviewNotebookGraphBatch,
  mobileReviewNotebookGraphEdge,
  mobileReviewNotebookGraphNode
} from '@/src/services/mobile-notebook-graph-review'
import { knowledgeIngestUserMessage, type KnowledgeNotebookStats } from './knowledge-screen.util'
import type {
  KnowledgeGraphEdgeRow,
  KnowledgeGraphNodeRow,
  KnowledgeOcrProgressState,
  KnowledgeSourceRow
} from './knowledge-detail.types'
import type { KnowledgeVectorChunkRow } from './KnowledgeDetailVectorsSection'

export function useKnowledgeDetail(notebookId: string) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { dbReady } = useBaishou()

  const [name, setName] = useState('')
  const [coverTone, setCoverTone] = useState('')
  const [coverIcon, setCoverIcon] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [sources, setSources] = useState<KnowledgeSourceRow[]>([])
  const [stats, setStats] = useState<KnowledgeNotebookStats | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modelMismatch, setModelMismatch] = useState(false)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [showImport, setShowImport] = useState<'text' | 'url' | null>(null)
  const [importProcessMode, setImportProcessMode] =
    useState<KnowledgeImportProcessMode>('both')
  const [graphNodes, setGraphNodes] = useState<KnowledgeGraphNodeRow[]>([])
  const [graphEdges, setGraphEdges] = useState<KnowledgeGraphEdgeRow[]>([])
  const [manageAction, setManageAction] = useState<NotebookDataManageAction>('reprocess')
  const [manageVector, setManageVector] = useState(true)
  const [manageGraph, setManageGraph] = useState(true)
  const [clearPhrase, setClearPhrase] = useState('')
  const [engine, setEngine] = useState<'ocr' | 'vision'>('ocr')
  const [ocrLanguage, setOcrLanguage] = useState('chi_sim+eng')
  const [ocrUseCustom, setOcrUseCustom] = useState(false)
  const [ocrConcurrency, setOcrConcurrency] = useState(DEFAULT_OCR_CONCURRENCY)
  const [ocrProgressBySource, setOcrProgressBySource] = useState<
    Record<string, KnowledgeOcrProgressState>
  >({})
  const [vectorQuery, setVectorQuery] = useState('')
  const [vectorItems, setVectorItems] = useState<KnowledgeVectorChunkRow[]>([])
  const [vectorTotal, setVectorTotal] = useState(0)
  const [vectorLoading, setVectorLoading] = useState(false)
  const [graphSearchQuery, setGraphSearchQuery] = useState('')
  const [graphTab, setGraphTab] = useState<'canvas' | 'pending' | 'similar'>('canvas')
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null)
  const [graphHighlightIds, setGraphHighlightIds] = useState<Set<string>>(() => new Set())
  const [graphLocateIds, setGraphLocateIds] = useState<string[] | null>(null)
  const [graphLocateSeq, setGraphLocateSeq] = useState(0)
  const [similarPairs, setSimilarPairs] = useState<GraphSimilarPendingPair[]>([])
  const [reviewBusy, setReviewBusy] = useState(false)
  const [graphProgress, setGraphProgress] = useState('')
  const [vaultId, setVaultId] = useState('')

  const refreshDetail = useCallback(async () => {
    if (!notebookId) return
    const notebook = await mobileGetNotebook(notebookId)
    if (!notebook) throw new Error(t('knowledge.not_found', '找不到这本笔记本'))
    setName(notebook.name)
    setCoverTone(notebook.coverTone || '')
    setCoverIcon(notebook.coverIcon || '')
    setCoverImage(notebook.coverImage || '')
    const uri = notebook.coverImage
      ? await mobileResolveNotebookCoverUri(notebook.coverImage)
      : null
    setCoverUri(uri)
    const list = (await mobileListSources(notebookId)) as KnowledgeSourceRow[]
    setSources(list || [])
    try {
      const next = await mobileGetKnowledgeStats(notebookId)
      setStats({
        sources: next.sources,
        chunks: next.chunks,
        pendingJobs: next.pendingJobs,
        originalBytes: next.originalBytes ?? 0,
        totalBytes: next.totalBytes ?? 0
      })
    } catch {
      /* 统计失败时仍刷新资料 */
    }
    try {
      setModelMismatch(await mobileHasKnowledgeModelMismatch([notebookId]))
    } catch {
      setModelMismatch(false)
    }
    try {
      const view = await mobileGetNotebookGraphView(notebookId, 400)
      setGraphNodes(
        (view.nodes || []).map((n) => ({
          id: n.id,
          name: n.name,
          nodeType: n.nodeType,
          reviewStatus: n.reviewStatus,
          summary: n.summary,
          propsJson: n.propsJson
        }))
      )
      setGraphEdges(
        (view.edges || []).map((e) => ({
          id: e.id,
          fromId: e.fromId,
          toId: e.toId,
          edgeType: e.edgeType,
          reviewStatus: e.reviewStatus,
          sourceExcerpt: e.sourceExcerpt
        }))
      )
    } catch {
      setGraphNodes([])
      setGraphEdges([])
    }
    try {
      const activeVaultId = await resolveMobileActiveVaultId()
      setVaultId(activeVaultId)
      setSimilarPairs(
        await mobileListNotebookSimilarPendingPairs({ notebookId, vaultId: activeVaultId })
      )
    } catch {
      setSimilarPairs([])
    }
    try {
      const jobs = await mobileListNotebookGraphJobs(notebookId)
      setGraphProgress(
        jobs.pending + jobs.running > 0
          ? `${jobs.currentSourceTitle || ''} ${jobs.running}/${jobs.pending + jobs.running}`
          : ''
      )
    } catch {
      setGraphProgress('')
    }
  }, [notebookId, t])

  useEffect(() => {
    if (!dbReady || !notebookId) return
    void refreshDetail().catch((e) => setError(String((e as Error)?.message || e)))
    void mobileGetKnowledgeConfig()
      .then((cfg) => {
        setEngine(normalizeKnowledgeDefaultExtractEngine(cfg.defaultExtractEngine) === 'vision' ? 'vision' : 'ocr')
        setOcrLanguage(cfg.ocrLanguage || 'chi_sim+eng')
        setOcrConcurrency(clampOcrConcurrency(cfg.ocrConcurrency))
      })
      .catch(() => undefined)
    void mobileRecoverStaleIngest().catch(() => undefined)
  }, [dbReady, notebookId, refreshDetail])

  useEffect(() => {
    return subscribeMobileKnowledgeExtractProgress((info) => {
      setOcrProgressBySource((prev) => {
        if (info.total <= 0) {
          const next = { ...prev }
          delete next[info.sourceId]
          return next
        }
        return { ...prev, [info.sourceId]: { page: info.page, total: info.total, phase: info.phase } }
      })
    })
  }, [])

  const refreshVectors = useCallback(async () => {
    if (!notebookId) return
    setVectorLoading(true)
    try {
      const page = await mobileListKnowledgeChunks({
        notebookId,
        query: vectorQuery,
        limit: 20,
        offset: 0
      })
      setVectorItems(
        (page.items || []).map((item) => ({
          chunkId: item.chunkId,
          sourceTitle: item.sourceTitle,
          chunkIndex: item.chunkIndex,
          chunkText: item.chunkText,
          modelId: item.modelId
        }))
      )
      setVectorTotal(page.total || 0)
    } catch {
      setVectorItems([])
      setVectorTotal(0)
    } finally {
      setVectorLoading(false)
    }
  }, [notebookId, vectorQuery])

  useEffect(() => {
    if (!dbReady || !notebookId) return
    const timer = setTimeout(() => {
      void refreshVectors()
    }, 300)
    return () => clearTimeout(timer)
  }, [dbReady, notebookId, refreshVectors])

  const hasActiveIngest =
    sources.some(
      (s) => s.status === 'pending' || s.status === 'extracting' || s.status === 'embedding'
    ) || (stats?.pendingJobs ?? 0) > 0

  useEffect(() => {
    if (!hasActiveIngest) return
    const timer = setInterval(() => {
      void refreshDetail().catch(() => undefined)
    }, 4000)
    return () => clearInterval(timer)
  }, [hasActiveIngest, refreshDetail])

  const phrase = t('knowledge.data_manage_clear_phrase', '确认清除')
  const canConfirm = canConfirmNotebookDataManage({
    action: manageAction,
    vector: manageVector,
    graph: manageGraph,
    phrase,
    typed: clearPhrase
  })

  const saveCover = async (patch: {
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }) => {
    setBusy(true)
    setError('')
    try {
      const updated = await mobileUpdateNotebook({ notebookId, ...patch })
      setCoverTone(updated.coverTone || '')
      setCoverIcon(updated.coverIcon || '')
      setCoverImage(updated.coverImage || '')
      setCoverUri(
        updated.coverImage ? await mobileResolveNotebookCoverUri(updated.coverImage) : null
      )
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const pickCoverImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9
    })
    if (picked.canceled || !picked.assets[0]?.uri) return
    setBusy(true)
    try {
      await mobileSetCoverImage({
        notebookId,
        absolutePath: picked.assets[0].uri
      })
      await refreshDetail()
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const rebuildIndex = async () => {
    setBusy(true)
    setError('')
    try {
      await mobileRebuildKnowledgeIndex(notebookId)
      setModelMismatch(await mobileHasKnowledgeModelMismatch([notebookId]))
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const retrySource = async (source: KnowledgeSourceRow) => {
    setBusy(true)
    setError('')
    try {
      await mobileRetrySource(source.id)
      await refreshDetail()
      toast.showSuccess(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const reprocessSourceGraph = async (source: KnowledgeSourceRow) => {
    const ok = await dialog.confirm(
      t(
        'knowledge.reembed_graph_confirm',
        '将按当前图抽取模型重新抽取「{{title}}」的关系。会先按这份资料清掉已抽出的节点和关系，再写入新结果；不会改动向量索引。可能耗时较长。',
        { title: source.title }
      ),
      {
        title: t('knowledge.reembed_graph', '重抽图'),
        confirmText: t('knowledge.reembed_graph', '重抽图'),
        cancelText: t('common.cancel', '取消')
      }
    )
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      await mobileReprocessSource(source.id, 'graph')
      await refreshDetail()
      toast.showSuccess(t('knowledge.reembed_graph_queued', '已开始重新抽取图数据'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const rebuildNotebookGraph = async () => {
    const ok = await dialog.confirm(
      t(
        'knowledge.rebuild_graph_confirm',
        '会按当前资料重新抽取笔记本内关系。每份资料会先清掉已抽出的节点和关系，再写入新结果，可能耗时较长。人生关系图不会被改动。'
      ),
      {
        title: t('knowledge.rebuild_graph', '重新抽取图谱'),
        confirmText: t('knowledge.rebuild_graph', '重新抽取图谱'),
        cancelText: t('common.cancel', '取消')
      }
    )
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      await mobileRebuildNotebookGraph(notebookId)
      await refreshDetail()
      toast.showSuccess(t('knowledge.reembed_graph_queued', '已开始重新抽取图数据'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const startOrganize = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await mobileOrganizeNotebook(notebookId)
      await refreshDetail()
      toast.showSuccess(
        result.queued > 0
          ? t('knowledge.data_manage_queued', '已加入重整理队列')
          : t('knowledge.data_manage_none', '没有可重整理的资料')
      )
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

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
      for (const asset of picked.assets) {
        const fileName = asset.name || 'import.bin'
        const absolutePath = await resolveMobileKnowledgeFilePath(asset.uri, fileName)
        await mobileImportSource({
          notebookId,
          title: fileName,
          kind: 'file',
          absolutePath,
          fileName,
          importProcessMode
        })
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

  const onDeleteSource = async (source: KnowledgeSourceRow) => {
    const ok = await dialog.confirm(
      t(
        'knowledge.delete_source_confirm',
        '将删除「{{title}}」的原文和提取结果，并清空这份资料对应的图关系和向量数据。此操作不能恢复。',
        { title: source.title }
      ),
      {
        title: t('knowledge.delete_source_title', '删除资料'),
        confirmText: t('knowledge.delete_source', '删除'),
        cancelText: t('common.cancel', '取消'),
        destructive: true
      }
    )
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      await mobileDeleteSource(source.id)
      await refreshDetail()
      toast.showSuccess(t('knowledge.source_deleted', '已删除资料'))
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onManage = async () => {
    if (!canConfirm || busy) return
    setBusy(true)
    setError('')
    try {
      const raw = await mobileManageNotebookData(notebookId, {
        action: manageAction,
        vector: manageVector,
        graph: manageGraph
      })
      const parsed = parseNotebookDataManageResult(raw)
      if (!parsed) throw new Error(t('knowledge.data_manage_failed', '数据管理未完成'))
      const kind = notebookDataManageStatusKind(parsed)
      if (kind === 'cleared')
        toast.showSuccess(t('knowledge.data_manage_cleared', '已清除派生数据'))
      else if (kind === 'reprocess-queued') {
        toast.showSuccess(t('knowledge.data_manage_queued', '已加入重整理队列'))
      } else {
        toast.showInfo(t('knowledge.data_manage_none', '没有可重整理的资料'))
      }
      setClearPhrase('')
      await refreshDetail()
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const deleteNotebook = async (): Promise<boolean> => {
    setBusy(true)
    setError('')
    try {
      await mobileDeleteNotebook(notebookId)
      toast.showSuccess(t('knowledge.notebook_deleted', '已删除笔记本'))
      return true
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
      return false
    } finally {
      setBusy(false)
    }
  }

  const confirmManage = async () => {
    if (manageAction === 'clear') {
      const ok = await dialog.confirm(
        t('knowledge.data_manage_clear_intro', '勾选要清除的派生数据。原文还在，清除后不能恢复。'),
        {
          title: t('knowledge.data_manage_clear', '清除数据'),
          confirmText: t('knowledge.data_manage_clear', '清除数据'),
          cancelText: t('common.cancel', '取消')
        }
      )
      if (ok) await onManage()
      return
    }
    await onManage()
  }

  const saveExtractConfig = async () => {
    setBusy(true)
    setError('')
    try {
      await mobileSetKnowledgeConfig({
        defaultExtractEngine: engine,
        ocrLanguage,
        ocrConcurrency: clampOcrConcurrency(ocrConcurrency)
      })
      toast.showSuccess(t('common.saved', '已保存'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const recoverStale = async () => {
    setBusy(true)
    setError('')
    try {
      await mobileRecoverStaleIngest()
      await refreshDetail()
      toast.showSuccess(t('knowledge.recover_stale_done', '已回收卡住的任务'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const embedSource = async (source: KnowledgeSourceRow) => {
    setBusy(true)
    setError('')
    try {
      await mobileEmbedSource(source.id)
      await refreshDetail()
      toast.showSuccess(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const cancelExtract = async (source: KnowledgeSourceRow) => {
    setBusy(true)
    setError('')
    try {
      await mobileCancelExtract(source.id)
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const ocrMissing = async (source: KnowledgeSourceRow) => {
    setBusy(true)
    setError('')
    try {
      await mobileOcrMissingPages(source.id, { engine })
      await refreshDetail()
      toast.showSuccess(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const previewExtracted = async (source: KnowledgeSourceRow) => {
    try {
      const preview = await mobileGetExtractedPreview({
        notebookId,
        sourceId: source.id
      })
      await dialog.alert(preview.text?.trim() || t('knowledge.extracted_empty', '还没有抽出正文'), {
        title: t('knowledge.extracted_preview', '抽出正文')
      })
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    }
  }

  const searchGraph = async () => {
    const q = graphSearchQuery.trim()
    if (!q) {
      setGraphHighlightIds(new Set())
      setGraphLocateIds(null)
      return
    }
    try {
      const hits = await mobileSearchNotebookGraphNodes({ notebookId, query: q, limit: 12 })
      const ids = hits.map((row) => row.id)
      setGraphHighlightIds(new Set(ids))
      setGraphLocateIds(ids)
      setGraphLocateSeq((n) => n + 1)
      if (ids[0]) setSelectedGraphId(ids[0])
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    }
  }

  const reviewNode = async (nodeId: string, status: 'approved' | 'rejected') => {
    if (!vaultId) return
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphNode({ notebookId, nodeId, reviewStatus: status, vaultId })
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const reviewEdge = async (edgeId: string, status: 'approved' | 'rejected') => {
    if (!vaultId) return
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphEdge({ notebookId, edgeId, reviewStatus: status, vaultId })
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const reviewAllPending = async (status: 'approved' | 'rejected') => {
    if (!vaultId) return
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphBatch({
        notebookId,
        vaultId,
        reviewStatus: status,
        allPending: true
      })
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const mergeSimilar = async (pair: GraphSimilarPendingPair) => {
    if (!vaultId) return
    const ok = await dialog.confirm(
      t('graph.merge_similar_confirm', '将把「{{loser}}」并入「{{survivor}}」。', {
        survivor: pair.nodeName,
        loser: pair.peerName
      }),
      { title: t('graph.merge', '合并') }
    )
    if (!ok) return
    setReviewBusy(true)
    try {
      await mobileMergeNotebookGraphNodes({
        notebookId,
        vaultId,
        survivorId: pair.nodeId,
        loserId: pair.peerId
      })
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const dismissSimilar = async (pair: GraphSimilarPendingPair) => {
    if (!vaultId) return
    setReviewBusy(true)
    try {
      await mobileDismissNotebookSimilarPair({
        notebookId,
        vaultId,
        nodeId: pair.nodeId,
        peerId: pair.peerId
      })
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const pendingNodes = graphNodes.filter((node) => node.reviewStatus === 'pending')
  const pendingEdges = graphEdges.filter((edge) => edge.reviewStatus === 'pending')

  return {
    dbReady,
    name,
    coverTone,
    coverIcon,
    coverImage,
    coverUri,
    sources,
    stats,
    error,
    busy,
    modelMismatch,
    pasteTitle,
    setPasteTitle,
    pasteText,
    setPasteText,
    urlValue,
    setUrlValue,
    showImport,
    setShowImport,
    importProcessMode,
    setImportProcessMode,
    graphNodes,
    graphEdges,
    manageAction,
    setManageAction,
    manageVector,
    setManageVector,
    manageGraph,
    setManageGraph,
    clearPhrase,
    setClearPhrase,
    phrase,
    canConfirm,
    saveCover,
    pickCoverImage,
    rebuildIndex,
    retrySource,
    reprocessSourceGraph,
    rebuildNotebookGraph,
    startOrganize,
    onImportText,
    onImportUrl,
    onImportFile,
    onDeleteSource,
    confirmManage,
    deleteNotebook,
    engine,
    ocrLanguage,
    ocrUseCustom,
    ocrConcurrency,
    setEngine,
    setOcrLanguage,
    setOcrUseCustom,
    setOcrConcurrency,
    saveExtractConfig,
    recoverStale,
    ocrProgressBySource,
    embedSource,
    cancelExtract,
    ocrMissing,
    previewExtracted,
    vectorQuery,
    setVectorQuery,
    vectorItems,
    vectorTotal,
    vectorLoading,
    graphSearchQuery,
    setGraphSearchQuery,
    graphTab,
    setGraphTab,
    selectedGraphId,
    setSelectedGraphId,
    graphHighlightIds,
    graphLocateIds,
    graphLocateSeq,
    searchGraph,
    pendingNodes,
    pendingEdges,
    similarPairs,
    reviewBusy,
    graphProgress,
    reviewNode,
    reviewEdge,
    reviewAllPending,
    mergeSimilar,
    dismissSimilar
  }
}
