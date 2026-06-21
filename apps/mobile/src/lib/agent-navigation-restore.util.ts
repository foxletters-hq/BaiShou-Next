/** 用户已切换到其他伙伴时，不应根据旧快照恢复上一伙伴的会话 */
export function shouldSkipSessionRestoreForAssistantMismatch(input: {
  currentAssistantId?: string | null
  savedAssistantId?: string | null
}): boolean {
  const { currentAssistantId, savedAssistantId } = input
  return Boolean(currentAssistantId && savedAssistantId && currentAssistantId !== savedAssistantId)
}

/** reconcile 节流：相同上下文在窗口期内跳过 */
export function shouldThrottleNavigationReconcile(input: {
  reconcileKey: string
  lastReconcileKey: string
  lastReconcileAtMs: number
  nowMs: number
  throttleMs: number
}): boolean {
  return (
    input.reconcileKey === input.lastReconcileKey &&
    input.nowMs - input.lastReconcileAtMs < input.throttleMs
  )
}

/** 伙伴切换或清空会话时应立即持久化导航快照 */
export function shouldPersistNavigationImmediately(input: {
  assistantChanged: boolean
  sessionCleared: boolean
}): boolean {
  return input.assistantChanged || input.sessionCleared
}
