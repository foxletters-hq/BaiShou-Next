import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentGateGroupedPending } from '@baishou/store'
import {
  collectAgentGatePendingLookupKeys,
  loadAgentGatePendingNameMaps,
  type AgentGatePendingNameMaps
} from '../utils/agent-gate-pending-labels.util'

const EMPTY_NAME_MAPS: AgentGatePendingNameMaps = {
  workspaceNames: {},
  sessionTitles: {}
}

export function useAgentGatePendingNameMaps(
  open: boolean,
  groups: AgentGateGroupedPending[]
): AgentGatePendingNameMaps {
  const { t } = useTranslation()
  const [maps, setMaps] = useState<AgentGatePendingNameMaps>(EMPTY_NAME_MAPS)
  const keys = useMemo(() => collectAgentGatePendingLookupKeys(groups), [groups])
  const untitledSession = t('workbench.untitled_session', '未命名会话')
  const lookupKey = `${keys.workspaceIds.join(',')}|${keys.sessionIds.join(',')}`

  useEffect(() => {
    if (!open && keys.workspaceIds.length === 0 && keys.sessionIds.length === 0) {
      return undefined
    }
    let cancelled = false

    void loadAgentGatePendingNameMaps(keys, {
      listWorkspaces: async () => (await window.api?.agentWorkspace?.listWorkspaces?.()) ?? [],
      listSessions: async () => (await window.api?.agentWorkspace?.listSessions?.()) ?? [],
      getSession: async (sessionId) => {
        const invoke = window.electron?.ipcRenderer?.invoke
        if (!invoke) return null
        const doc = (await invoke('agent:get-session', sessionId)) as {
          title?: string | null
        } | null
        return doc ?? null
      },
      untitledSession
    }).then((next) => {
      if (!cancelled) setMaps(next)
    })

    return () => {
      cancelled = true
    }
  }, [open, lookupKey, untitledSession, keys])

  return maps
}
