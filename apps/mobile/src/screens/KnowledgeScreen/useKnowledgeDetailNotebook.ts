import type { TFunction } from 'i18next'
import * as ImagePicker from 'expo-image-picker'
import {
  canConfirmNotebookDataManage,
  clampOcrConcurrency,
  formatExtractProbeSampleText,
  isVisionModel,
  listExtractProbeSources,
  notebookDataManageStatusKind,
  parseNotebookDataManageResult,
  type KnowledgeImportProcessMode,
  type NotebookDataManageAction
} from '@baishou/shared'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import {
  mobileDeleteNotebook,
  mobileHasKnowledgeModelMismatch,
  mobileManageNotebookData,
  mobileOrganizeNotebook,
  mobileRebuildKnowledgeIndex,
  mobileRebuildNotebookGraph,
  mobileRecoverStaleIngest,
  mobileResolveNotebookCoverUri,
  mobileProbeExtractSample,
  mobileSetKnowledgeConfig,
  mobileSetCoverImage,
  mobileUpdateNotebook
} from '@/src/services/mobile-knowledge.service'
import {
  mobileListKnowledgeModelOptions,
  mobileGetKnowledgeProcessLabels,
  mobileSetGlobalKnowledgeModel
} from '@/src/services/mobile-knowledge-models.service'
import { knowledgeIngestUserMessage } from './knowledge-screen.util'
import type { KnowledgeSourceRow } from './knowledge-detail.types'

export function useKnowledgeDetailNotebook(input: {
  notebookId: string
  name: string
  description: string
  engine: 'ocr' | 'vision'
  ocrLanguage: string
  ocrConcurrency: number
  probeSourceId: string
  sources: KnowledgeSourceRow[]
  manageAction: NotebookDataManageAction
  manageVector: boolean
  manageGraph: boolean
  clearPhrase: string
  busy: boolean
  t: TFunction
  toast: ReturnType<typeof useNativeToast>
  dialog: ReturnType<typeof useDialog>
  askHeavyConfirm: (opts: { title: string; body: string; confirmText: string }) => Promise<boolean>
  services: {
    settingsManager?: {
      get: <T>(key: string) => Promise<T | null | undefined>
    }
  } | null
  setBusy: (busy: boolean) => void
  setError: (message: string) => void
  setImportProcessMode: (mode: KnowledgeImportProcessMode) => void
  setName: (name: string) => void
  setDescription: (value: string) => void
  setCoverTone: (value: string) => void
  setCoverIcon: (value: string) => void
  setCoverImage: (value: string) => void
  setCoverUri: (value: string | null) => void
  setModelMismatch: (value: boolean) => void
  setClearPhrase: (value: string) => void
  setExtractedPreview: (
    value: { title: string; text: string; pages?: Array<{ page: number; text: string }> } | null
  ) => void
  refreshDetail: () => Promise<void>
}) {
  const {
    notebookId,
    name,
    description,
    engine,
    ocrLanguage,
    ocrConcurrency,
    probeSourceId,
    sources,
    manageAction,
    manageVector,
    manageGraph,
    clearPhrase,
    busy,
    t,
    toast,
    dialog,
    askHeavyConfirm,
    services,
    setBusy,
    setError,
    setImportProcessMode,
    setName,
    setDescription,
    setCoverTone,
    setCoverIcon,
    setCoverImage,
    setCoverUri,
    setModelMismatch,
    setClearPhrase,
    setExtractedPreview,
    refreshDetail
  } = input

  const phrase = t('knowledge.data_manage_clear_phrase', '确认清除')
  const canConfirm = canConfirmNotebookDataManage({
    action: manageAction,
    vector: manageVector,
    graph: manageGraph,
    phrase,
    typed: clearPhrase
  })

  const persistImportProcessMode = async (mode: KnowledgeImportProcessMode) => {
    setImportProcessMode(mode)
    try {
      await mobileSetKnowledgeConfig({ importProcessMode: mode })
    } catch {
      /* 列表仍可按本次选择导入 */
    }
  }

  const saveCover = async (patch: {
    name?: string
    description?: string
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }) => {
    setBusy(true)
    setError('')
    try {
      const updated = await mobileUpdateNotebook({ notebookId, ...patch })
      setName(updated.name)
      setDescription(updated.description || '')
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
    const ok = await askHeavyConfirm({
      title: t('knowledge.rebuild_index', '重建索引'),
      body: t(
        'knowledge.rebuild_index_confirm',
        '将按当前嵌入模型重建本笔记本的向量索引。已有向量会先清掉再重建，可能耗时较长。'
      ),
      confirmText: t('knowledge.rebuild_index', '重建索引')
    })
    if (!ok) return
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

  const rebuildNotebookGraph = async () => {
    const ok = await askHeavyConfirm({
      title: t('knowledge.rebuild_graph', '重新抽取图谱'),
      body: t(
        'knowledge.rebuild_graph_confirm',
        '会按当前资料重新抽取笔记本内关系。每份资料会先清掉已抽出的节点和关系，再写入新结果，可能耗时较长。人生关系图不会被改动。'
      ),
      confirmText: t('knowledge.rebuild_graph', '重新抽取图谱')
    })
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

  const pickVisionModel = async () => {
    const providers =
      (await services?.settingsManager?.get<
        Array<{
          id: string
          name?: string
          type?: string
          models?: string[]
          enabledModels?: string[]
        }>
      >('ai_providers')) || []
    const options: Array<{ label: string; value: string }> = [
      { label: t('knowledge.vision_follow_global', '跟随全局对话模型'), value: '' }
    ]
    for (const provider of providers) {
      const models = provider.enabledModels?.length ? provider.enabledModels : provider.models || []
      for (const model of models) {
        if (!isVisionModel(model, provider.type || provider.id)) continue
        options.push({
          label: `${provider.name || provider.id} / ${model}`,
          value: `${provider.id}::${model}`
        })
      }
    }
    const picked = await dialog.choose(t('knowledge.vision_model', '视觉模型'), options)
    if (picked == null) return
    setBusy(true)
    try {
      if (!picked) {
        await mobileSetKnowledgeConfig({ visionProviderId: null, visionModelId: null })
      } else {
        const splitAt = picked.indexOf('::')
        await mobileSetKnowledgeConfig({
          visionProviderId: picked.slice(0, splitAt),
          visionModelId: picked.slice(splitAt + 2)
        })
      }
      toast.showSuccess(t('common.saved', '已保存'))
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const probeExtract = async () => {
    const pdfSources = listExtractProbeSources(sources)
    const source = pdfSources.find((row) => row.id === probeSourceId) || pdfSources[0]
    if (!source) {
      toast.showError(t('knowledge.probe_need_pdf', '试抽只支持 PDF，请先导入一份 PDF'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const sample = await mobileProbeExtractSample({
        notebookId,
        sourceId: source.id,
        engine,
        ocrLanguage,
        ocrConcurrency
      })
      const pages = Array.isArray(sample?.pages) ? sample.pages : []
      setExtractedPreview({
        title: t('knowledge.extract_probe', '试抽'),
        text:
          formatExtractProbeSampleText(pages) || t('knowledge.extracted_empty', '还没有抽出正文'),
        pages: pages.map((page) => ({
          page: page.page,
          text: String(page.text || '').trim()
        }))
      })
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const pickSlotModel = async (field: 'embedding' | 'graph') => {
    const options = await mobileListKnowledgeModelOptions(
      field === 'embedding' ? 'embedding' : 'dialogue'
    )
    if (options.length === 0) {
      toast.showError(t('settings.no_models_available', '还没有可用模型'))
      return
    }
    const title =
      field === 'embedding'
        ? t('knowledge.embedding_model', '嵌入模型')
        : t('knowledge.graph_model', '图抽取模型')
    const picked = await dialog.choose(title, options)
    if (picked == null || !picked) return
    const splitAt = picked.indexOf('::')
    if (field === 'embedding') {
      const labels = await mobileGetKnowledgeProcessLabels()
      if (labels.embeddingModelId) {
        const ok = await dialog.confirm(
          t(
            'agent.rag.migration_switch_warning_content',
            '新模型可能与现有向量不兼容，更换后将在后台重新嵌入日记数据。是否继续？'
          ),
          { title: t('agent.rag.migration_switch_warning_title', '更换嵌入模型？') }
        )
        if (!ok) return
      }
    }
    setBusy(true)
    try {
      await mobileSetGlobalKnowledgeModel({
        field,
        providerId: picked.slice(0, splitAt),
        modelId: picked.slice(splitAt + 2)
      })
      toast.showSuccess(t('common.saved', '已保存'))
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const renameNotebook = async () => {
    const draft = await dialog.prompt(
      t('knowledge.notebook_name', '名称'),
      name,
      t('knowledge.rename_notebook', '重命名')
    )
    const next = draft?.trim()
    if (!next || next === name) return
    await saveCover({ name: next })
  }

  const editDescription = async () => {
    const draft = await dialog.prompt(
      t('knowledge.notebook_description', '简介，可以留空'),
      description,
      t('knowledge.notebook_description_title', '笔记本简介')
    )
    if (draft == null) return
    await saveCover({ description: draft.trim() })
  }

  return {
    phrase,
    canConfirm,
    persistImportProcessMode,
    saveCover,
    pickCoverImage,
    rebuildIndex,
    rebuildNotebookGraph,
    startOrganize,
    confirmManage,
    deleteNotebook,
    saveExtractConfig,
    recoverStale,
    pickVisionModel,
    pickEmbeddingModel: () => pickSlotModel('embedding'),
    pickGraphModel: () => pickSlotModel('graph'),
    probeExtract,
    renameNotebook,
    editDescription
  }
}
