const INIT_META_PREFIX = 'baishou:ws-init-meta:'

export type WorkspaceInitSendMeta = {
  text: string
  displayText?: string
  skillRefs?: Array<{ command: string; content: string }>
}

export function stashWorkspaceInitMeta(sessionId: string, meta: WorkspaceInitSendMeta): void {
  try {
    sessionStorage.setItem(`${INIT_META_PREFIX}${sessionId}`, JSON.stringify(meta))
  } catch {
    // ignore quota / private mode
  }
}

export function consumeWorkspaceInitMeta(sessionId: string): WorkspaceInitSendMeta | null {
  try {
    const key = `${INIT_META_PREFIX}${sessionId}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    sessionStorage.removeItem(key)
    const parsed = JSON.parse(raw) as WorkspaceInitSendMeta
    if (!parsed || typeof parsed.text !== 'string') return null
    return parsed
  } catch {
    return null
  }
}
