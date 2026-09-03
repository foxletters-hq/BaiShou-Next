const INIT_META_PREFIX = 'baishou:ws-init-meta:'
const memoryStash = new Map<string, WorkspaceInitSendMeta>()

export type WorkspaceInitSendMeta = {
  text: string
  displayText?: string
  skillRefs?: Array<{ command: string; content: string }>
  fileRefs?: Array<{
    relativePath: string
    selection?: { startLine: number; endLine: number }
    comment?: string
    origin?: 'explorer-drop' | 'mention' | 'selection' | 'comment'
  }>
  attachments?: unknown[]
}

function storageKey(sessionId: string): string {
  return `${INIT_META_PREFIX}${sessionId}`
}

function isValidInitMeta(value: unknown): value is WorkspaceInitSendMeta {
  return Boolean(value && typeof value === 'object' && typeof (value as WorkspaceInitSendMeta).text === 'string')
}

function toPersistableAttachments(attachments?: unknown[]): unknown[] | undefined {
  if (!Array.isArray(attachments) || attachments.length === 0) return undefined
  return attachments.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
    const { data: _data, ...rest } = raw as Record<string, unknown>
    return rest
  })
}

export function stashWorkspaceInitMeta(sessionId: string, meta: WorkspaceInitSendMeta): void {
  memoryStash.set(sessionId, meta)
  try {
    sessionStorage.setItem(
      storageKey(sessionId),
      JSON.stringify({
        text: meta.text,
        displayText: meta.displayText,
        skillRefs: meta.skillRefs,
        fileRefs: meta.fileRefs,
        attachments: toPersistableAttachments(meta.attachments)
      })
    )
  } catch {
    // ignore quota / private mode
  }
}

export function consumeWorkspaceInitMeta(sessionId: string): WorkspaceInitSendMeta | null {
  const fromMemory = memoryStash.get(sessionId)
  if (fromMemory) {
    memoryStash.delete(sessionId)
    try {
      sessionStorage.removeItem(storageKey(sessionId))
    } catch {
      // ignore
    }
    return fromMemory
  }

  try {
    const key = storageKey(sessionId)
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    sessionStorage.removeItem(key)
    const parsed: unknown = JSON.parse(raw)
    if (!isValidInitMeta(parsed)) return null
    return parsed
  } catch {
    return null
  }
}
