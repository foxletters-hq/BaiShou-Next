import { useCallback, useState } from 'react'
import {
  mobileGetKnowledgeProcessLabels,
  type peekCachedKnowledgeProcessLabels
} from '@/src/services/mobile-knowledge-models.service'

type CachedKnowledgeProcessLabels = ReturnType<typeof peekCachedKnowledgeProcessLabels>

/**
 * 知识库详情页的模型标签与模型切换器状态。
 * 只负责展示用的标签和当前选择，真正的保存动作由主 hook 编排。
 */
export function useKnowledgeDetailModels(input: { cachedLabels: CachedKnowledgeProcessLabels }) {
  const cachedLabels = input.cachedLabels
  const [embeddingModelLabel, setEmbeddingModelLabel] = useState(
    cachedLabels?.embeddingModelLabel ?? ''
  )
  const [graphModelLabel, setGraphModelLabel] = useState(cachedLabels?.graphModelLabel ?? '')
  const [embeddingProviderId, setEmbeddingProviderId] = useState(
    cachedLabels?.embeddingProviderId ?? ''
  )
  const [graphProviderId, setGraphProviderId] = useState(cachedLabels?.graphProviderId ?? '')
  const [modelsLoaded, setModelsLoaded] = useState(Boolean(cachedLabels))
  const [visionProviderId, setVisionProviderId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')
  const [embeddingModelId, setEmbeddingModelId] = useState(cachedLabels?.embeddingModelId ?? '')
  const [graphModelId, setGraphModelId] = useState(cachedLabels?.graphModelLabel ?? '')
  const [modelSwitcherSlot, setModelSwitcherSlot] = useState<
    'vision' | 'embedding' | 'graph' | null
  >(null)

  const refreshModels = useCallback(async () => {
    try {
      const labels = await mobileGetKnowledgeProcessLabels()
      setEmbeddingModelLabel(labels.embeddingModelLabel)
      setGraphModelLabel(labels.graphModelLabel)
      setEmbeddingProviderId(labels.embeddingProviderId || '')
      setGraphProviderId(labels.graphProviderId || '')
      setEmbeddingModelId(labels.embeddingModelId || '')
      setGraphModelId(labels.graphModelLabel || '')
    } catch {
      /* 模型名仅作提示 */
    } finally {
      setModelsLoaded(true)
    }
  }, [])

  return {
    fields: {
      embeddingModelLabel,
      graphModelLabel,
      embeddingProviderId,
      graphProviderId,
      visionProviderId,
      modelsLoaded,
      visionModelId,
      embeddingModelId,
      graphModelId,
      modelSwitcherSlot,
      pickVisionModel: () => setModelSwitcherSlot('vision'),
      pickEmbeddingModel: () => setModelSwitcherSlot('embedding'),
      pickGraphModel: () => setModelSwitcherSlot('graph'),
      closeModelSwitcher: () => setModelSwitcherSlot(null)
    },
    refreshModels,
    setVisionProviderId,
    setVisionModelId,
    setModelSwitcherSlot
  }
}
