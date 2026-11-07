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

/** 伙伴切换、会话变更或清空会话时应立即持久化导航快照（避免 Tab 切走时被防抖取消） */
export function shouldPersistNavigationImmediately(input: {
  assistantChanged: boolean
  sessionCleared: boolean
  sessionChanged: boolean
}): boolean {
  return input.assistantChanged || input.sessionCleared || input.sessionChanged
}

/** 冷启动初始恢复未完成前，若开启了恢复且当前无会话，禁止持久化空快照避免抹平历史会话 */
export function shouldSkipNavigationPersistBeforeRestore(input: {
  restoreLastSessionOnReturn?: boolean
  initialRestoreDone: boolean
  currentSessionId: string | null
}): boolean {
  return Boolean(
    input.restoreLastSessionOnReturn !== false &&
    !input.initialRestoreDone &&
    !input.currentSessionId
  )
}
