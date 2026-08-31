import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentWorkspaceSessionListItem } from '@baishou/shared'

async function persistSessionPinned(sessionId: string, pinned: boolean): Promise<void> {
  const pinSession = window.api?.agentWorkspace?.pinSession
  if (pinSession) {
    const result = await pinSession(sessionId, pinned)
    if (result?.success === false) {
      throw new Error('pin session failed')
    }
    return
  }
  await window.electron.ipcRenderer.invoke('agent:pin-session', sessionId, pinned)
}

export function useWorkspaceSessions() {
  const [sessions, setSessions] = useState<AgentWorkspaceSessionListItem[]>([])
  const [loading, setLoading] = useState(false)
  const pendingPinsRef = useRef(new Map<string, boolean>())

  const loadSessions = useCallback(async () => {
    if (!window.api?.agentWorkspace?.listSessions) {
      setSessions([])
      return
    }
    setLoading(true)
    try {
      const rows = await window.api.agentWorkspace.listSessions()
      const list = Array.isArray(rows) ? rows : []
      setSessions(
        list.map((row) => {
          const pending = pendingPinsRef.current.get(row.sessionId)
          if (pending === undefined) return row
          if (Boolean(row.isPinned) === pending) {
            pendingPinsRef.current.delete(row.sessionId)
            return row
          }
          return { ...row, isPinned: pending }
        })
      )
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    const refresh = () => {
      void loadSessions()
    }
    window.addEventListener('baishou:workspace-sessions-changed', refresh)
    return () => window.removeEventListener('baishou:workspace-sessions-changed', refresh)
  }, [loadSessions])

  const pinSession = useCallback(async (sessionId: string, pinned: boolean) => {
    pendingPinsRef.current.set(sessionId, pinned)
    setSessions((prev) =>
      prev.map((item) => (item.sessionId === sessionId ? { ...item, isPinned: pinned } : item))
    )
    try {
      await persistSessionPinned(sessionId, pinned)
    } catch (error) {
      pendingPinsRef.current.delete(sessionId)
      setSessions((prev) =>
        prev.map((item) =>
          item.sessionId === sessionId ? { ...item, isPinned: !pinned } : item
        )
      )
      throw error
    }
  }, [])

  return { sessions, loading, reloadSessions: loadSessions, pinSession }
}
