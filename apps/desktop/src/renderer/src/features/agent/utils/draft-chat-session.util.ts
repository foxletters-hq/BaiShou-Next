export function isDraftChatSessionId(sessionId: string | undefined): boolean {
  if (!sessionId) return true
  if (sessionId === 'new-session') return true
  return /^new-\d+$/.test(sessionId)
}
