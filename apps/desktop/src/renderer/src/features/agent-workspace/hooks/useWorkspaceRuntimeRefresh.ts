import { useEffect } from 'react'

/** 订阅工作区文件树刷新事件；仅用于触发 chat 侧同步时请改用 workspace-messages-changed */
export function useWorkspaceRuntimeRefresh(
  sessionId: string | undefined,
  onRefresh: () => void
): void {
  useEffect(() => {
    if (!sessionId || sessionId === 'new-session') return

    const onMessagesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail
      if (detail?.sessionId && detail.sessionId !== sessionId) return
      onRefresh()
    }

    // 回滚等会同时发 tree-refresh；聊天内容仍靠 messages-changed / 显式 refresh
    window.addEventListener('baishou:workspace-messages-changed', onMessagesChanged)
    return () => {
      window.removeEventListener('baishou:workspace-messages-changed', onMessagesChanged)
    }
  }, [onRefresh, sessionId])
}
