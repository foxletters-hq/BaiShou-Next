export interface ToolExecution {
  name: string
  durationMs?: number
  result?: unknown
  toolCallId?: string
}

export interface NativeStreamingBubbleProps {
  text: string
  reasoning?: string
  isReasoning?: boolean
  activeToolName?: string | null
  completedTools?: ToolExecution[]
  aiProfile?: {
    name: string
    avatarPath?: string | null
    /** 相对路径 avatars/… 解析后的本地 URI */
    resolvedAvatarUri?: string | null
    emoji?: string | null
  }
  error?: string | null
  onRetry?: () => void
  /** 自定义聊天背景上为名称启用反色混合 */
  invertMetaOverBackground?: boolean
}
