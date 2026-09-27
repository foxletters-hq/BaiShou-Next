import { useCallback, useEffect, useState } from 'react'
import {
  mobileListKnowledgeChunks,
  mobileSearchKnowledge
} from '@/src/services/mobile-knowledge.service'
import type { KnowledgeVectorChunkRow } from './KnowledgeDetailVectorsSection'

export function useKnowledgeDetailVectors(input: { notebookId: string; dbReady: boolean }) {
  const { notebookId, dbReady } = input
  const [vectorQuery, setVectorQueryState] = useState('')
  const [vectorPage, setVectorPage] = useState(1)
  const [vectorPageSize, setVectorPageSizeState] = useState(20)
  const [vectorSearchMode, setVectorSearchModeState] = useState<'text' | 'semantic'>('text')
  const [vectorItems, setVectorItems] = useState<KnowledgeVectorChunkRow[]>([])
  const [vectorTotal, setVectorTotal] = useState(0)
  const [vectorLoading, setVectorLoading] = useState(false)
  const [vectorSourceCount, setVectorSourceCount] = useState(0)
  const [vectorModelId, setVectorModelId] = useState<string | null>(null)

  const setVectorQuery = (value: string) => {
    setVectorPage(1)
    setVectorQueryState(value)
  }
  const setVectorSearchMode = (mode: 'text' | 'semantic') => {
    setVectorPage(1)
    setVectorSearchModeState(mode)
  }
  const setVectorPageSize = (size: number) => {
    setVectorPage(1)
    setVectorPageSizeState(size)
  }

  const refreshVectors = useCallback(async () => {
    if (!notebookId) return
    setVectorLoading(true)
    try {
      const q = vectorQuery.trim()
      if (q && vectorSearchMode === 'semantic') {
        const hits = await mobileSearchKnowledge({
          notebookId,
          query: q,
          limit: vectorPageSize
        })
        const sourceIds = new Set((hits || []).map((hit) => hit.sourceId))
        setVectorItems(
          (hits || []).map((hit) => ({
            chunkId: hit.chunkId,
            sourceTitle: hit.title || hit.sourceId,
            chunkIndex: hit.chunkIndex,
            chunkText: hit.chunkText,
            modelId: null,
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
      setVectorModelId(firstModel ?? null)
    } catch {
      setVectorItems([])
      setVectorTotal(0)
      setVectorSourceCount(0)
      setVectorModelId(null)
    } finally {
      setVectorLoading(false)
    }
  }, [notebookId, vectorPage, vectorPageSize, vectorQuery, vectorSearchMode])

  useEffect(() => {
    if (!dbReady || !notebookId) return
    const timer = setTimeout(() => {
      void refreshVectors()
    }, 300)
    return () => clearTimeout(timer)
  }, [dbReady, notebookId, refreshVectors])

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
