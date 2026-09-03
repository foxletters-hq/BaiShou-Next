export function shouldQueueWorkbenchFileContext(params: {
  agentPanelCollapsed: boolean
  sessionsViewOpen: boolean
  agentPanelMounted: boolean
}): boolean {
  return params.agentPanelCollapsed || params.sessionsViewOpen || !params.agentPanelMounted
}
