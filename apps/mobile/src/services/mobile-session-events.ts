type SessionChangeListener = (payload: { sessionId: string; newTitle?: string }) => void

const listeners = new Set<SessionChangeListener>()

/**
 * 订阅移动端会话变更事件（如命名模型更新标题）
 */
export function subscribeMobileSessionChanged(listener: SessionChangeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 广播会话变更（如命名模型更新标题或删除/重建会话）
 */
export function notifyMobileSessionChanged(sessionId: string, newTitle?: string): void {
  for (const listener of listeners) {
    try {
      listener({ sessionId, newTitle })
    } catch (e) {
      console.warn('[MobileSessionEvents] listener execution failed:', e)
    }
  }
}
