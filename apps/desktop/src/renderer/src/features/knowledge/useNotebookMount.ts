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
import { resolveNotebookCoverPreviewUrl } from './notebook-list.util'

/** 笔记本挂载变更事件：让输入框标签与挂载对话框实时同步 */
export const NOTEBOOK_MOUNT_CHANGED_EVENT = 'baishou:notebook-mount-changed'

export function notifyNotebookMountChanged(sessionId?: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(NOTEBOOK_MOUNT_CHANGED_EVENT, {
      detail: { sessionId: sessionId ?? null }
    })
  )
}

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
          mixedEmbeddings: row.mixedEmbeddings,
          coverTone: row.coverTone,
          coverIcon: row.coverIcon,
          coverImageUrl: resolveNotebookCoverPreviewUrl(row.coverImageUrl, row.updatedAt),
          graphNodes: row.graphNodes,
          graphEdges: row.graphEdges
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [draft, pendingKey, sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // 挂载对话框与输入框标签共享同一份挂载结果：任一处改动后都立即刷新
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string | null }>).detail
      const changedSessionId = detail?.sessionId ?? null
      if (changedSessionId && sessionId && changedSessionId !== sessionId) return
      void refresh()
    }
    window.addEventListener(NOTEBOOK_MOUNT_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(NOTEBOOK_MOUNT_CHANGED_EVENT, onChanged)
  }, [refresh, sessionId])

  const persist = async (next: string[]) => {
    setBusy(true)
    setError('')
    try {
      if (draft) {
        setSelectedIds(setPendingMountedNotebookIds(pendingKey, next))
        notifyNotebookMountChanged(sessionId)
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
      notifyNotebookMountChanged(sessionId)
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
