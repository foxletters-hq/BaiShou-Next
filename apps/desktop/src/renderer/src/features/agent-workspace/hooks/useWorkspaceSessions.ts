import { useCallback, useEffect, useState } from 'react'
import type { AgentWorkspaceSessionListItem } from '@baishou/shared'

export function useWorkspaceSessions() {
  const [sessions, setSessions] = useState<AgentWorkspaceSessionListItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadSessions = useCallback(async () => {
    if (!window.api?.agentWorkspace?.listSessions) {
      setSessions([])
      return
    }
    setLoading(true)
    try {
      const rows = await window.api.agentWorkspace.listSessions()
      setSessions(Array.isArray(rows) ? rows : [])
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

  return { sessions, loading, reloadSessions: loadSessions }
}
