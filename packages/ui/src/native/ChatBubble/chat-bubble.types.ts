import type {
  AgentGatePartData,
  AgentStreamTimelineItem,
  FileCiteRef,
  MockChatAttachment,
  SkillCiteRef
} from '@baishou/shared'

export interface ChatBubbleMessage {
  id?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  skillRefs?: SkillCiteRef[]
  fileRefs?: FileCiteRef[]
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
  parts?: Array<{ type?: string; id?: string; data?: unknown }>
}

export interface NativeChatLiveStream {
  content?: string
  reasoning?: string
  isTextStreaming?: boolean
  /** 思考进行中：仅控制标题左侧转圈 */
  isThinkLoading?: boolean
  /** 思考正文走 Streamdown 渐显，对齐桌面 Think isStreaming */
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
  /** 按发生顺序展开思考 / 工具 / 正文；有值时优先于压扁字段 */
  timeline?: AgentStreamTimelineItem[]
  /** 本轮已确认的权限，收在流式气泡时间线里 */
  gateParts?: AgentGatePartData[]
  /** 流式阶段尚未落库的表情包附件 */
  attachments?: MockChatAttachment[]
  error?: string | null
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
  liveStream?: NativeChatLiveStream
  /** 本轮流式失败时显示在助手气泡下 */
  error?: string | null
  /** 流式/桥接期间隐藏操作栏与 token 行，避免结束时布局突增 */
  deferAssistantChrome?: boolean
  showReasoning?: boolean
}
