import type { MessageWithParts } from './message.adapter'

export interface CompressionSnapshotRef {
  coveredUpToMessageId: string
  /** 累计已压缩消息条数（用于锚点 id 丢失时的回退） */
  messageCount?: number
  summaryText?: string | null
  tailStartMessageId?: string | null
  [key: string]: any
}

export interface SessionCompressionConfig {
  threshold: number
  keepTurns: number
  /** 伙伴自定义压缩系统提示词；空则用当前语言默认 */
  systemPrompt?: string
  /** 工具调用时可强制压缩，忽略 token 阈值 */
  force?: boolean
  /** 模型上下文窗口（token）；用于按窗口触发压缩 */
  modelContextWindow?: number
  /** 为输出与系统提示预留的 token；usable = window - reserved */
  reservedTokens?: number
  /** 保留区 token 预算 */
  preserveRecentTokens?: number
}

export interface CompressionBatchResult {
  toCompress: MessageWithParts[]
  tailStartMessageId: string | null
}
