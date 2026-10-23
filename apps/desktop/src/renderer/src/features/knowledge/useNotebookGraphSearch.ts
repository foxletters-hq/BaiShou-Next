import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { GraphSearchMode } from '@baishou/shared'
import { callKnowledgeApi } from './call-knowledge-api'
import { graphSearchErrorCopy } from '../graph/graph-page-derive.util'

type SearchHit = { id: string; name: string; nodeType: string; summary?: string }

type UseNotebookGraphSearchOptions = {
  notebookId: string
  t: TFunction
  toast: { showError: (message: string) => void }
  openSide: (mode: 'content') => void
  setTab: (tab: 'detail') => void
  setHighlightIds: Dispatch<SetStateAction<Set<string>>>
  setLocateIds: Dispatch<SetStateAction<string[] | null>>
  setLocateSeq: Dispatch<SetStateAction<number>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
}

/** 笔记本图谱内的节点搜索、结果高亮与面板外点击关闭 */
export function useNotebookGraphSearch({
  notebookId,
  t,
  toast,
  openSide,
  setTab,
  setHighlightIds,
  setLocateIds,
  setLocateSeq,
  setSelectedId
}: UseNotebookGraphSearchOptions) {
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<GraphSearchMode>('semantic')
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [searchAttempted, setSearchAttempted] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchGroupRef = useRef<HTMLDivElement>(null)

  const dismissSearchPanel = () => {
    setSearchAttempted(false)
    setSearching(false)
  }

  useEffect(() => {
    if (!searching && !searchAttempted) return
    const onPointerDown = (event: MouseEvent) => {
      const root = searchGroupRef.current
      if (!root || root.contains(event.target as Node)) return
      dismissSearchPanel()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissSearchPanel()
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [searchAttempted, searching])

  const onSearch = async (nextMode: GraphSearchMode = searchMode) => {
    const q = query.trim()
    if (!q) {
      setSearchAttempted(false)
      setSearchHits([])
      return
    }
    setSearchAttempted(true)
    setSearching(true)
    try {
      const hits = await callKnowledgeApi<SearchHit[]>('graphSearch', 'knowledge:graph-search', {
        notebookId,
        query: q,
        limit: 20,
        mode: nextMode
      })
      const list = hits || []
      setSearchHits(list)
      const ids = list.map((hit) => hit.id)
      setHighlightIds(new Set(ids))
      if (ids.length === 0) return
      setLocateIds(ids)
      setLocateSeq((n) => n + 1)
      setSelectedId(ids[0] ?? null)
      setTab('detail')
      openSide('content')
    } catch (error) {
      setSearchHits([])
      const copy = graphSearchErrorCopy(error)
      toast.showError('key' in copy ? t(copy.key, copy.fallback) : copy.raw)
    } finally {
      setSearching(false)
    }
  }

  return {
    query,
    setQuery,
    searchMode,
    setSearchMode,
    searchHits,
    searchAttempted,
    setSearchAttempted,
    searching,
    searchGroupRef,
    onSearch,
    dismissSearchPanel
  }
}
