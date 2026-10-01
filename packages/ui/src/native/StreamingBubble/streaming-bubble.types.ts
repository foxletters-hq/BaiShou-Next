import type {
  AgentGatePartData,
  AgentStreamTimelineItem,
  MockChatAttachment
} from '@baishou/shared'

export interface ToolExecution {
  name: string
  durationMs?: number
  result?: unknown
  toolCallId?: string
  args?: unknown
}

export interface NativeStreamingBubbleProps {
  text: string
  reasoning?: string
  isReasoning?: boolean
  /** reasoning 正文是否走 Streamdown 渐显 */
  isThinkStreaming?: boolean
  /** 正文是否仍在流式输出（桥接态应为 false） */
  isTextStreaming?: boolean
  activeToolName?: string | null
  completedTools?: ToolExecution[]
  /** 按发生顺序展开思考 / 工具 / 正文；有值时优先于压扁字段 */
  timeline?: AgentStreamTimelineItem[]
  /** 本轮已确认的权限，收在流式气泡里 */
  gateParts?: AgentGatePartData[]
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
  /** 流结束交接期：预留与 ChatBubble 操作栏等高的空间，避免列表跳动 */
  reserveActionBarSpace?: boolean
  /** 流式阶段尚未落库的表情包附件 */
  attachments?: MockChatAttachment[]
}
