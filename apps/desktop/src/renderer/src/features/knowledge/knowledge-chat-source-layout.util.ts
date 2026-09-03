/** 聊天工作区达到该宽度（像素）时，有来源则常态展示左侧来源栏。 */
export const KNOWLEDGE_CHAT_SOURCE_DOCK_MIN_WIDTH = 880

export type KnowledgeChatSourceLayout = 'hidden' | 'docked' | 'collapsed'

export function hasKnowledgeChatSources(sourceCount: number, uploadingCount = 0): boolean {
  return sourceCount > 0 || uploadingCount > 0
}

export function resolveKnowledgeChatSourceLayout(input: {
  sourceCount: number
  uploadingCount?: number
  workspaceWidth: number | null
}): KnowledgeChatSourceLayout {
  if (!hasKnowledgeChatSources(input.sourceCount, input.uploadingCount ?? 0)) {
    return 'hidden'
  }
  if (input.workspaceWidth != null && input.workspaceWidth < KNOWLEDGE_CHAT_SOURCE_DOCK_MIN_WIDTH) {
    return 'collapsed'
  }
  return 'docked'
}
