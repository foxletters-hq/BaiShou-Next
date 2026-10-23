import { useEffect, useRef, useState } from 'react'
import { resolveGraphSearchMode, type GraphSearchMode } from '@baishou/shared'
import {
  filterGraphSearchHits,
  graphSearchErrorCopy,
  graphSearchHitViewState
} from './graph-page-derive.util'

type SearchDeps = {
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string
  toast: { showError: (message: string) => void }
  setStatus: (status: string) => void
  setHighlightIds: (ids: Set<string>) => void
  setHighlightedEdgeIds: (ids: Set<string>) => void
  setSelectedId: (id: string | null) => void
  setSelectedNode: (node: any | null) => void
  setLocalView: (view: { nodes: any[]; edges: any[] } | null) => void
  setPinNeighborhood: (pin: boolean) => void
  setLocateIds: (ids: string[] | null) => void
  setLocateSeq: (updater: (n: number) => number) => void
}

export function useGraphPageSearch(deps: SearchDeps) {
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<GraphSearchMode>('text')
  const [searchHits, setSearchHits] = useState<any[]>([])
  const [searchAttempted, setSearchAttempted] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchGroupRef = useRef<HTMLDivElement>(null)

  const dismissSearchPanel = () => {
    setSearchAttempted(false)
    setSearching(false)
  }

  const clearSearchHits = () => {
    setSearchHits([])
    setSearchAttempted(false)
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

  const applySearchHits = (hits: any[]) => {
    const list = filterGraphSearchHits(hits)
    setSearchHits(list)
    const next = graphSearchHitViewState(list)
    deps.setHighlightIds(new Set(next.highlightIds))
    deps.setHighlightedEdgeIds(new Set())
    deps.setSelectedId(null)
    deps.setSelectedNode(null)
    if (next.localView == null) {
      deps.setLocalView(null)
      deps.setPinNeighborhood(false)
      deps.setLocateIds(null)
      return
    }
    deps.setLocalView(next.localView)
    deps.setPinNeighborhood(true)
    deps.setLocateIds(next.locateIds)
    deps.setLocateSeq((n) => n + 1)
  }

  const onSearch = async (nextMode: GraphSearchMode = searchMode) => {
    const q = query.trim()
    if (!q) {
      setSearchAttempted(false)
      applySearchHits([])
      return
    }
    setSearchAttempted(true)
    setSearching(true)
    try {
      const searchOpts = {
        query: q,
        limit: 20,
        mode: nextMode
      }
      const hits = await window.api.graph.search(searchOpts)
      applySearchHits(hits || [])
    } catch (error) {
      applySearchHits([])
      const copy = graphSearchErrorCopy(error)
      const message = 'key' in copy ? deps.t(copy.key, copy.fallback) : copy.raw
      deps.setStatus(message)
      deps.toast.showError(message)
    } finally {
      setSearching(false)
    }
  }

  const changeSearchMode = (mode: string) => {
    const next = resolveGraphSearchMode(mode)
    setSearchMode(next)
    if (query.trim()) void onSearch(next)
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
    dismissSearchPanel,
    clearSearchHits,
    applySearchHits,
    onSearch,
    changeSearchMode
  }
}
