function loadWorkbenchHomeChunk(): void {
  void import('../features/agent-workspace/AgentWorkspaceCachedPage')
}

/** 日记列表第一次画完后，空闲时只预取工作台首页，不拉聊天壳。 */
export function prefetchWorkbenchHome(): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      loadWorkbenchHomeChunk()
    })
    return
  }
  setTimeout(() => {
    loadWorkbenchHomeChunk()
  }, 1)
}
