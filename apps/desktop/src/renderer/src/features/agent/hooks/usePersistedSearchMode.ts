import { useEffect, useRef } from 'react'
import { useAgentStore } from '@baishou/store'

/** 桌面端：从设置读写联网搜索开关，并与 AgentStore 同步 */
export function usePersistedSearchMode() {
  const searchMode = useAgentStore((s) => s.searchMode)
  const setSearchMode = useAgentStore((s) => s.setSearchMode)
  const toggleSearchMode = useAgentStore((s) => s.toggleSearchMode)
  const loadedRef = useRef(false)

  useEffect(() => {
    const api = (window as any).api
    if (!api?.settings?.getSearchModeEnabled) {
      loadedRef.current = true
      return
    }

    void api.settings
      .getSearchModeEnabled()
      .then((enabled: boolean) => {
        setSearchMode(!!enabled)
        loadedRef.current = true
      })
      .catch(() => {
        loadedRef.current = true
      })
  }, [setSearchMode])

  useEffect(() => {
    if (!loadedRef.current) return
    const api = (window as any).api
    api?.settings?.setSearchModeEnabled?.(searchMode)
  }, [searchMode])

  return { searchMode, setSearchMode, toggleSearchMode }
}
