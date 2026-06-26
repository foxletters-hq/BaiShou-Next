import { useEffect } from 'react'

/** 订阅工作区文件树/磁盘状态刷新（如回滚后），触发 UI 重新同步 */
export function useWorkspaceRuntimeRefresh(
  sessionId: string | undefined,
  onRefresh: () => void
): void {
  useEffect(() => {
    if (!sessionId || sessionId === 'new-session') return

    const onTreeRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail
      if (detail?.sessionId && detail.sessionId !== sessionId) return
      onRefresh()
    }

    window.addEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
    return () => {
      window.removeEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
    }
  }, [onRefresh, sessionId])
}
