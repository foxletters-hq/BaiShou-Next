export interface ChatBubbleMessage {
  id?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  reasoning?: string
  isReasoning?: boolean
  timestamp?: Date
  toolInvocations?: unknown[]
  attachments?: unknown[]
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
  costMicros?: number
  contextMessages?: ChatBubbleMessage[]
}

export interface ChatBubbleProps {
  message: ChatBubbleMessage
  userProfile?: { nickname: string; avatarPath?: string | null; resolvedAvatarUri?: string | null }
  aiProfile?: {
    name: string
    avatarPath?: string | null
    resolvedAvatarUri?: string | null
    emoji?: string | null
  }
  onEdit?: () => void
  onRegenerate?: () => void
  onResend?: () => void
  onCopy?: () => void
  onDelete?: () => void
  onBranch?: () => void
  onSaveEdit?: (newContent: string) => void
  onResendEdit?: (newContent: string) => void
  onShowContext?: (msg: ChatBubbleMessage) => void
  onReadAloud?: (content: string) => void
  isTtsPlaying?: boolean
  /** 气泡进入/退出内联编辑时通知父级（用于键盘与底部输入栏联动） */
  onEditingChange?: (editing: boolean, messageId?: string) => void
  /** 自定义聊天背景上为名称与操作按钮启用反色混合 */
  invertMetaOverBackground?: boolean
  /** 重试/重新发送处理中时禁用，避免连点 */
  retryDisabled?: boolean
  /** 流式期间用 liveStream 覆盖展示内容，避免与 StreamingBubble 互换 */
  liveStream?: {
    content?: string
    reasoning?: string
    isTextStreaming?: boolean
    isThinkStreaming?: boolean
    /** 进行中的工具展示名（已本地化） */
    activeToolName?: string | null
    /** 流式阶段已完成的工具（与 StreamingBubble 同结构） */
    completedTools?: Array<{
      name: string
      durationMs: number
      toolCallId?: string
      result?: unknown
      args?: unknown
    }>
  }
  /** 流式/桥接期间隐藏操作栏与 token 行，避免结束时布局突增 */
  deferAssistantChrome?: boolean
  showReasoning?: boolean
}
