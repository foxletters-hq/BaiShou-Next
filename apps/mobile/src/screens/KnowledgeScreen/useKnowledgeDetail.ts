import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import {
  canConfirmNotebookDataManage,
  notebookDataManageStatusKind,
  parseNotebookDataManageResult,
  type NotebookDataManageAction
} from '@baishou/shared'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import {
  mobileDeleteSource,
  mobileGetKnowledgeStats,
  mobileGetNotebook,
  mobileGetNotebookGraphView,
  mobileHasKnowledgeModelMismatch,
  mobileImportSource,
  mobileListSources,
  mobileManageNotebookData,
  mobileRebuildKnowledgeIndex,
  mobileRebuildNotebookGraph,
  mobileReprocessSource,
  mobileResolveNotebookCoverUri,
  mobileRetrySource,
  mobileSetCoverImage,
  mobileUpdateNotebook
} from '@/src/services/mobile-knowledge.service'
import { knowledgeIngestUserMessage, type KnowledgeNotebookStats } from './knowledge-screen.util'
import type {
  KnowledgeGraphEdgeRow,
  KnowledgeGraphNodeRow,
  KnowledgeSourceRow
} from './knowledge-detail.types'

export function useKnowledgeDetail(notebookId: string) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { dbReady, services } = useBaishou()

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
  const [graphNodes, setGraphNodes] = useState<KnowledgeGraphNodeRow[]>([])
  const [graphEdges, setGraphEdges] = useState<KnowledgeGraphEdgeRow[]>([])
  const [manageAction, setManageAction] = useState<NotebookDataManageAction>('reprocess')
  const [manageVector, setManageVector] = useState(true)
  const [manageGraph, setManageGraph] = useState(true)
  const [clearPhrase, setClearPhrase] = useState('')

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
      const view = await mobileGetNotebookGraphView(notebookId, 80)
      setGraphNodes(
        (view.nodes || []).map((n) => ({ id: n.id, name: n.name, nodeType: n.nodeType }))
      )
      setGraphEdges(
        (view.edges || []).map((e) => ({
          id: e.id,
          fromId: e.fromId,
          toId: e.toId,
          edgeType: e.edgeType
        }))
      )
    } catch {
      setGraphNodes([])
      setGraphEdges([])
    }
  }, [notebookId, t])

  useEffect(() => {
    if (!dbReady || !notebookId) return
    void refreshDetail().catch((e) => setError(String((e as Error)?.message || e)))
  }, [dbReady, notebookId, refreshDetail])

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
    const batchEmbed = services?.ragService?.batchEmbed
    if (!batchEmbed) {
      setError(t('knowledge.api_not_ready', '知识库接口未就绪，请完全退出并重新打开应用后再试'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await batchEmbed()
      await refreshDetail()
      toast.showSuccess(t('knowledge.data_manage_queued', '已加入重整理队列'))
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
        textContent: pasteText
      })
      setPasteTitle('')
      setPasteText('')
      setShowImport(null)
      await refreshDetail()
      toast.showSuccess(t('knowledge.import_queued', '已加入摄入队列'))
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
        originUrl
      })
      setUrlValue('')
      setShowImport(null)
      await refreshDetail()
      toast.showSuccess(t('knowledge.import_queued', '已加入摄入队列'))
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
    onDeleteSource,
    confirmManage
  }
}
