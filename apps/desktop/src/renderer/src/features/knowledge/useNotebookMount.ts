import { useCallback, useEffect, useState } from 'react'
import {
  getPendingMountedNotebookIds,
  isDraftNotebookMountSessionId,
  notebookMountPendingKey,
  parseMountedNotebookIds,
  setPendingMountedNotebookIds,
  toggleMountedNotebook,
  type NotebookMountCandidate,
  type NotebookMountScope
} from '@baishou/shared'

export function useNotebookMount(
  sessionId?: string,
  opts?: { assistantId?: string | null; scope?: NotebookMountScope }
) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [candidates, setCandidates] = useState<NotebookMountCandidate[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const draft = isDraftNotebookMountSessionId(sessionId)
  const pendingKey = notebookMountPendingKey({
    sessionId,
    assistantId: opts?.assistantId,
    scope: opts?.scope ?? 'companion'
  })

  const refresh = useCallback(async () => {
    setError('')
    try {
      const list = await window.api.knowledge.listMountSummaries()
      const ids = draft
        ? getPendingMountedNotebookIds(pendingKey)
        : window.api.getMountedNotebooks
          ? await window.api.getMountedNotebooks(sessionId!)
          : []
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
  }, [draft, pendingKey, sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const persist = async (next: string[]) => {
    setBusy(true)
    setError('')
    try {
      if (draft) {
        setSelectedIds(setPendingMountedNotebookIds(pendingKey, next))
        return
      }
      if (!sessionId) return
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
