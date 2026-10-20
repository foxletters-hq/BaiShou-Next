export type ChatInitMeta = {
  displayText?: string
  skillRefs?: Array<{ command: string; content: string }>
}

/** 读取一次性的聊天初始化元数据（发送后即删除，避免刷新重复消费） */
export function consumeChatInitMeta(draftSessionId: string): ChatInitMeta | null {
  try {
    const key = `baishou:chat-init-meta:${draftSessionId}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    sessionStorage.removeItem(key)
    const parsed = JSON.parse(raw) as ChatInitMeta & { text?: string }
    if (!parsed || typeof parsed !== 'object') return null
    return {
      displayText: parsed.displayText,
      skillRefs: parsed.skillRefs
    }
  } catch {
    return null
  }
}
