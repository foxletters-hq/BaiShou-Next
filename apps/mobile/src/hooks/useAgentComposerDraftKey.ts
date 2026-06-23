import { useEffect, useMemo, useState } from 'react'
import { useBaishou } from '../providers/BaishouProvider'

/** 按工作区 + 会话隔离输入框草稿 */
export function useAgentComposerDraftKey(sessionId: string | null) {
  const { services, vaultRevision } = useBaishou()
  const [vaultKey, setVaultKey] = useState('default')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const name = await services?.pathService.getActiveVaultNameForContext().catch(() => 'default')
      if (!cancelled) setVaultKey(name || 'default')
    })()
    return () => {
      cancelled = true
    }
  }, [services, vaultRevision])

  return useMemo(
    () => `agent-composer:${vaultKey}:${sessionId ?? 'new'}`,
    [vaultKey, sessionId]
  )
}
