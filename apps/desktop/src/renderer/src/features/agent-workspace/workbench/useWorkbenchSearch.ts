import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  WorkspaceReplaceResult,
  WorkspaceSearchFileResult,
  WorkspaceSearchResult
} from '@baishou/shared'

export interface WorkbenchSearchState {
  pattern: string
  replace: string
  matchCase: boolean
  matchWholeWord: boolean
  useRegex: boolean
  includePattern: string
  excludePattern: string
  showReplace: boolean
  showFilters: boolean
}

const DEFAULT_STATE: WorkbenchSearchState = {
  pattern: '',
  replace: '',
  matchCase: false,
  matchWholeWord: false,
  useRegex: false,
  includePattern: '',
  excludePattern: '',
  showReplace: false,
  showFilters: false
}

function storageKey(folderRoot: string): string {
  return `baishou:workbench-search:${folderRoot.replace(/\\/g, '/').toLowerCase()}`
}

function loadState(folderRoot: string | null): WorkbenchSearchState {
  if (!folderRoot) return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(storageKey(folderRoot))
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<WorkbenchSearchState>) }
  } catch {
    return DEFAULT_STATE
  }
}

function persistState(folderRoot: string, state: WorkbenchSearchState): void {
  const {
    pattern,
    replace,
    matchCase,
    matchWholeWord,
    useRegex,
    includePattern,
    excludePattern,
    showReplace,
    showFilters
  } = state
  localStorage.setItem(
    storageKey(folderRoot),
    JSON.stringify({
      pattern,
      replace,
      matchCase,
      matchWholeWord,
      useRegex,
      includePattern,
      excludePattern,
      showReplace,
      showFilters
    })
  )
}

export function useWorkbenchSearch(folderRoot: string | null) {
  const [state, setState] = useState<WorkbenchSearchState>(() => loadState(folderRoot))
  const [result, setResult] = useState<WorkspaceSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set())
  const requestIdRef = useRef(0)

  useEffect(() => {
    setState(loadState(folderRoot))
    setResult(null)
    setError(null)
    setCollapsedFiles(new Set())
  }, [folderRoot])

  useEffect(() => {
    if (!folderRoot) return
    persistState(folderRoot, state)
  }, [folderRoot, state])

  const patchState = useCallback((patch: Partial<WorkbenchSearchState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const runSearch = useCallback(async () => {
    if (!folderRoot) return
    const pattern = state.pattern.trim()
    if (!pattern) {
      setResult(null)
      setError(null)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const next = await window.api.agentWorkspace.searchFiles(folderRoot, {
        pattern,
        matchCase: state.matchCase,
        matchWholeWord: state.matchWholeWord,
        useRegex: state.useRegex,
        includePattern: state.includePattern || undefined,
        excludePattern: state.excludePattern || undefined
      })
      if (requestIdRef.current !== requestId) return
      setResult(next)
      setCollapsedFiles(new Set())
      if (next.invalidPattern) {
        setError('无效的正则表达式')
      }
    } catch (searchError) {
      if (requestIdRef.current !== requestId) return
      setResult(null)
      setError(searchError instanceof Error ? searchError.message : '搜索失败')
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [folderRoot, state])

  useEffect(() => {
    if (!folderRoot) return
    const timer = window.setTimeout(() => {
      void runSearch()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [folderRoot, runSearch])

  const clearSearch = useCallback(() => {
    requestIdRef.current += 1
    setState((prev) => ({ ...prev, pattern: '', replace: '' }))
    setResult(null)
    setError(null)
    setLoading(false)
  }, [])

  const replaceAll = useCallback(async (): Promise<WorkspaceReplaceResult | null> => {
    if (!folderRoot || !state.pattern.trim()) return null
    setReplacing(true)
    setError(null)
    try {
      const replaceResult = await window.api.agentWorkspace.replaceInFiles(folderRoot, {
        pattern: state.pattern,
        replacement: state.replace,
        matchCase: state.matchCase,
        matchWholeWord: state.matchWholeWord,
        useRegex: state.useRegex,
        includePattern: state.includePattern || undefined,
        excludePattern: state.excludePattern || undefined
      })
      if (replaceResult.errors.length > 0) {
        setError(replaceResult.errors[0] ?? '替换失败')
      }
      await runSearch()
      return replaceResult
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : '替换失败')
      return null
    } finally {
      setReplacing(false)
    }
  }, [folderRoot, runSearch, state])

  const toggleFileCollapsed = useCallback((relativePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(relativePath)) {
        next.delete(relativePath)
      } else {
        next.add(relativePath)
      }
      return next
    })
  }, [])

  const collapseAll = useCallback((files: WorkspaceSearchFileResult[]) => {
    setCollapsedFiles(new Set(files.map((file) => file.relativePath)))
  }, [])

  const expandAll = useCallback(() => {
    setCollapsedFiles(new Set())
  }, [])

  const summary = useMemo(() => {
    if (!result || state.pattern.trim() === '') return null
    return {
      matches: result.totalMatches,
      files: result.totalFiles,
      truncated: result.truncated
    }
  }, [result, state.pattern])

  return {
    state,
    patchState,
    result,
    loading,
    replacing,
    error,
    summary,
    collapsedFiles,
    toggleFileCollapsed,
    collapseAll,
    expandAll,
    runSearch,
    clearSearch,
    replaceAll
  }
}
