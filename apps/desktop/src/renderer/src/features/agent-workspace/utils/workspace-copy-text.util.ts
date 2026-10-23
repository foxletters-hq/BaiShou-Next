export function copyWorkspaceBubbleText(text: string): void {
  const value = text.trim()
  if (!value) return
  void navigator.clipboard.writeText(value).catch((error) => {
    console.error('[AgentWorkspaceMessageList] copy failed:', error)
  })
}
