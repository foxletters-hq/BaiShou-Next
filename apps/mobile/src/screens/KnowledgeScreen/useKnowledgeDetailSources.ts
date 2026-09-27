import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import {
  mobileCancelExtract,
  mobileDeleteSource,
  mobileEmbedSource,
  mobileGetExtractedPreview,
  mobileOcrMissingPages,
  mobileReprocessSource,
  mobileRetrySource
} from '@/src/services/mobile-knowledge.service'
import {
  mobileGetSourceFile,
  type MobileKnowledgeSourceFilePreview
} from '@/src/services/mobile-knowledge-preview.service'
import { knowledgeIngestUserMessage } from './knowledge-screen.util'
import type { KnowledgeSourceRow } from './knowledge-detail.types'

export function useKnowledgeDetailSources(input: {
  notebookId: string
  engine: 'ocr' | 'vision'
  t: TFunction
  toast: ReturnType<typeof useNativeToast>
  dialog: ReturnType<typeof useDialog>
  askHeavyConfirm: (opts: { title: string; body: string; confirmText: string }) => Promise<boolean>
  setBusy: (busy: boolean) => void
  setError: (message: string) => void
  refreshDetail: () => Promise<void>
  openTextPreview: (title: string, text: string) => void
}) {
  const {
    notebookId,
    engine,
    t,
    toast,
    dialog,
    askHeavyConfirm,
    setBusy,
    setError,
    refreshDetail,
    openTextPreview
  } = input
  const [sourcePreview, setSourcePreview] = useState<{
    title: string
    loading: boolean
    error: string | null
    payload: MobileKnowledgeSourceFilePreview | null
  } | null>(null)

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

  const reprocessSourceVector = async (source: KnowledgeSourceRow) => {
    const ok = await askHeavyConfirm({
      title: t('knowledge.reembed_vector', '重新嵌入'),
      body: t(
        'knowledge.reembed_vector_confirm',
        '将按当前嵌入模型重新嵌入「{{title}}」的向量。已有向量会先清掉再重建。可能耗时较长。',
        { title: source.title }
      ),
      confirmText: t('knowledge.reembed_vector', '重新嵌入')
    })
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      await mobileReprocessSource(source.id, 'embed')
      await refreshDetail()
      toast.showSuccess(t('knowledge.reembed_vector_queued', '已开始重新嵌入'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const reprocessSourceGraph = async (source: KnowledgeSourceRow) => {
    const ok = await askHeavyConfirm({
      title: t('knowledge.reembed_graph', '重抽图'),
      body: t(
        'knowledge.reembed_graph_confirm',
        '将按当前图抽取模型重新抽取「{{title}}」的关系。会先按这份资料清掉已抽出的节点和关系，再写入新结果；不会改动向量索引。可能耗时较长。',
        { title: source.title }
      ),
      confirmText: t('knowledge.reembed_graph', '重抽图')
    })
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

  const embedSource = async (source: KnowledgeSourceRow) => {
    const ok = await askHeavyConfirm({
      title: t('knowledge.embed_source', '开始嵌入'),
      body: t('knowledge.embed_source_confirm', '将嵌入「{{title}}」并整理向量。可能耗时较长。', {
        title: source.title
      }),
      confirmText: t('knowledge.embed_source', '开始嵌入')
    })
    if (!ok) return
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
      openTextPreview(
        t('knowledge.extracted_preview', '抽出正文'),
        preview.text?.trim() || t('knowledge.extracted_empty', '还没有抽出正文')
      )
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    }
  }

  const previewOriginal = async (source: KnowledgeSourceRow) => {
    setSourcePreview({
      title: source.title,
      loading: true,
      error: null,
      payload: null
    })
    try {
      const payload = await mobileGetSourceFile({ sourceId: source.id })
      setSourcePreview({ title: source.title, loading: false, error: null, payload })
    } catch (e) {
      setSourcePreview({
        title: source.title,
        loading: false,
        error: knowledgeIngestUserMessage(e, t),
        payload: null
      })
    }
  }

  return {
    retrySource,
    reprocessSourceGraph,
    reprocessSourceVector,
    onDeleteSource,
    embedSource,
    cancelExtract,
    ocrMissing,
    previewExtracted,
    previewOriginal,
    sourcePreview,
    closeSourcePreview: () => setSourcePreview(null),
    openFragmentPreview: (title: string) => {
      setSourcePreview({
        title,
        loading: false,
        error: null,
        payload: null
      })
    }
  }
}
