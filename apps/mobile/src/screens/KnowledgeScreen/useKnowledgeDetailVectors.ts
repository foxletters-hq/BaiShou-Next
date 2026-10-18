import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { EMBEDDING_NOT_CONFIGURED, KNOWLEDGE_MODEL_MISMATCH } from '@baishou/shared'
import {
  mobileListKnowledgeChunks,
  mobileSearchKnowledge
} from '@/src/services/mobile-knowledge.service'
import type { KnowledgeVectorChunkRow } from './KnowledgeDetailVectorsSection'

export function useKnowledgeDetailVectors(input: { notebookId: string; dbReady: boolean }) {
  const { notebookId, dbReady } = input
  const { t } = useTranslation()
  const toast = useNativeToast()

  const [vectorQuery, setVectorQueryState] = useState('')
  const [vectorPage, setVectorPageState] = useState(1)
  const [vectorPageSize, setVectorPageSizeState] = useState(20)
  const [vectorSearchMode, setVectorSearchModeState] = useState<'text' | 'semantic'>('semantic')
  const [vectorItems, setVectorItems] = useState<KnowledgeVectorChunkRow[]>([])
  const [vectorTotal, setVectorTotal] = useState(0)
  const [vectorLoading, setVectorLoading] = useState(false)
  const [vectorSourceCount, setVectorSourceCount] = useState(0)
  const [vectorModelId, setVectorModelId] = useState<string | null>(null)

  const queryGenerationRef = useRef(0)

  const setVectorQuery = (value: string) => {
    queryGenerationRef.current += 1
    setVectorLoading(true)
    setVectorPageState(1)
    setVectorQueryState(value)
  }
  const setVectorSearchMode = (mode: 'text' | 'semantic') => {
    queryGenerationRef.current += 1
    setVectorLoading(true)
    setVectorPageState(1)
    setVectorSearchModeState(mode)
  }
  const setVectorPage = (page: number) => {
    queryGenerationRef.current += 1
    setVectorLoading(true)
    setVectorPageState(page)
  }
  const setVectorPageSize = (size: number) => {
    queryGenerationRef.current += 1
    setVectorLoading(true)
    setVectorPageState(1)
    setVectorPageSizeState(size)
  }

  const refreshVectors = useCallback(
    async (generation: number) => {
      if (!notebookId) {
        if (generation === queryGenerationRef.current) {
          setVectorLoading(false)
        }
        return
      }

      try {
        const q = vectorQuery.trim()
        if (q && vectorSearchMode === 'semantic') {
          const hits = await mobileSearchKnowledge({
            notebookId,
            query: q,
            limit: vectorPageSize
          })
          if (generation !== queryGenerationRef.current) return

          const sourceIds = new Set((hits || []).map((hit) => hit.sourceId))
          setVectorItems(
            (hits || []).map((hit) => ({
              chunkId: hit.chunkId,
              sourceTitle: hit.title || hit.sourceId,
              chunkIndex: hit.chunkIndex,
              chunkText: hit.chunkText,
              modelId: vectorModelId,
              score: hit.score
            }))
          )
          setVectorTotal((hits || []).length)
          setVectorSourceCount(sourceIds.size)
          return
        }

        const page = await mobileListKnowledgeChunks({
          notebookId,
          query: vectorQuery,
          limit: vectorPageSize,
          offset: (vectorPage - 1) * vectorPageSize
        })
        if (generation !== queryGenerationRef.current) return

        const sourceTitles = new Set(
          (page.items || []).map((item) => item.sourceTitle || item.chunkId)
        )
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
        setVectorSourceCount(sourceTitles.size)
        const firstModel = (page.items || []).find((item) => item.modelId)?.modelId
        if (firstModel) {
          setVectorModelId(firstModel)
        }
      } catch (err) {
        if (generation !== queryGenerationRef.current) return
        console.error('[useKnowledgeDetailVectors] refreshVectors failed:', err)
        setVectorItems([])
        setVectorTotal(0)
        setVectorSourceCount(0)

        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg === EMBEDDING_NOT_CONFIGURED) {
          toast.showError(
            t('settings.rag_semantic_not_available_content', '语义搜索需要配置嵌入模型。')
          )
        } else if (errMsg === KNOWLEDGE_MODEL_MISMATCH) {
          toast.showError(t('settings.rag_model_mismatch_title', '嵌入模型不一致'))
        } else {
          toast.showError(errMsg || t('settings.rag_operation_failed', '操作失败'))
        }
      } finally {
        if (generation === queryGenerationRef.current) {
          setVectorLoading(false)
        }
      }
    },
    [notebookId, vectorPage, vectorPageSize, vectorQuery, vectorSearchMode, vectorModelId, t, toast]
  )

  useEffect(() => {
    if (!dbReady || !notebookId) return
    const gen = ++queryGenerationRef.current
    setVectorLoading(true)
    const timer = setTimeout(() => {
      void refreshVectors(gen)
    }, 300)
    return () => clearTimeout(timer)
  }, [
    dbReady,
    notebookId,
    vectorQuery,
    vectorSearchMode,
    vectorPage,
    vectorPageSize,
    refreshVectors
  ])

  return {
    vectorQuery,
    setVectorQuery,
    vectorPage,
    setVectorPage,
    vectorPageSize,
    setVectorPageSize,
    vectorSearchMode,
    setVectorSearchMode,
    vectorItems,
    vectorTotal,
    vectorLoading,
    vectorSourceCount,
    vectorModelId,
    setVectorModelId
  }
}
