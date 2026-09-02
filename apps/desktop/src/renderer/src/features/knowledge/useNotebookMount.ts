import { useCallback, useEffect, useState } from 'react'
import {
  parseMountedNotebookIds,
  toggleMountedNotebook,
  type NotebookMountCandidate
} from '@baishou/shared'

export function useNotebookMount(sessionId?: string) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [candidates, setCandidates] = useState<NotebookMountCandidate[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!sessionId || sessionId === 'new-session') {
      setSelectedIds([])
      setCandidates([])
      return
    }
    setError('')
    try {
      const [ids, list] = await Promise.all([
        window.api.getMountedNotebooks
          ? window.api.getMountedNotebooks(sessionId)
          : Promise.resolve([] as string[]),
        window.api.knowledge.listMountSummaries()
      ])
      setSelectedIds(parseMountedNotebookIds(ids))
      setCandidates(
        (list || []).map((row) => ({
          id: row.id,
          name: row.name,
          sources: row.sources,
          chunks: row.chunks,
          dimension: row.dimension,
          mixedEmbeddings: row.mixedEmbeddings
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const persist = async (next: string[]) => {
    if (!sessionId || sessionId === 'new-session') return
    setBusy(true)
    setError('')
    try {
      if (window.api.setMountedNotebooks) {
        await window.api.setMountedNotebooks(sessionId, next)
      } else {
        await window.api.agentWorkspace.attachNotebook({
          sessionId,
          notebookIds: next
        })
      }
      setSelectedIds(next)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (candidateId: string) => {
    const result = toggleMountedNotebook({
      selectedIds,
      candidateId,
      candidates
    })
    if (result.error) {
      setError(result.error)
      return
    }
    await persist(result.next)
  }

  const clear = async () => persist([])

  const selected = candidates.filter((row) => selectedIds.includes(row.id))

  return {
    selectedIds,
    selected,
    candidates,
    busy,
    error,
    refresh,
    toggle,
    clear
  }
}
