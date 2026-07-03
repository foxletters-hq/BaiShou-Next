import { SessionRepository } from '@baishou/database'
import { MessageWithParts } from './message.adapter'
// @ts-ignore
import { SnapshotRepository } from '@baishou/database'
import { normalizeCompressionOutput } from '@baishou/shared'
import { resolveSnapshotCutoffIndex } from './context-compression.utils'
import { COMPRESSION_MESSAGE_FETCH_LIMIT } from './compression.constants'

export interface ContextWindowConfig {
  /**
   * 保留最近的对话轮数（≤0 表示不截断，除 Snapshot 摘要外）。
   * 一轮：从用户消息开始，到下一轮用户消息之前的全部内容（含 assistant 回复及该轮内的 tool 调用/结果）。
   */
  recentCount: number
  /**
   * 仅保留 orderIndex ≤ 此值的消息，用于还原历史某轮发送给 AI 的上下文。
   */
  upToOrderIndex?: number
}

type CompressionSnapshot = Awaited<ReturnType<SnapshotRepository['getLatestSnapshot']>>

export class ContextWindowBuilder {
  /**
   * 从数据库安全构建将发送给 LLM 的窗口消息列表
   * 包含：
   * 1. 最近的压缩历史挂载于 System 首条
   * 2. 滑动窗口尾随保留
   * 3. 安全退行以保证没有孤立 ToolCall/Result 悬挂
   */
  static async build(
    sessionId: string,
    sessionRepo: SessionRepository,
    snapshotRepo: SnapshotRepository,
    config: ContextWindowConfig = { recentCount: 30 }
  ): Promise<MessageWithParts[]> {
    const rawMessages = (await sessionRepo.getMessagesBySession(
      sessionId,
      COMPRESSION_MESSAGE_FETCH_LIMIT
    )) as MessageWithParts[]
    return this.buildFromMessages(sessionId, snapshotRepo, rawMessages, config)
  }

  /** 复用已加载的会话消息，避免 streamChat 内重复全量查询 */
  static async buildFromMessages(
    sessionId: string,
    snapshotRepo: SnapshotRepository,
    rawMessages: MessageWithParts[],
    config: ContextWindowConfig = { recentCount: 30 },
    snapshotOverride?: CompressionSnapshot | null
  ): Promise<MessageWithParts[]> {
    if (rawMessages.length === 0) return []

    let messages = rawMessages
    if (config.upToOrderIndex !== undefined) {
      messages = messages.filter((m) => m.orderIndex <= config.upToOrderIndex!)
    }
    if (messages.length === 0) return []

    let effectiveMessages: MessageWithParts[] = []

    const snapshot =
      snapshotOverride === undefined
        ? await snapshotRepo.getLatestSnapshot(sessionId)
        : snapshotOverride

    if (snapshot) {
      let retainStartIndex = -1
      if (snapshot.tailStartMessageId) {
        retainStartIndex = messages.findIndex((m) => m.id === snapshot.tailStartMessageId)
      }
      if (retainStartIndex < 0) {
        const cutoffIndex = resolveSnapshotCutoffIndex(messages, snapshot)
        if (cutoffIndex >= 0) retainStartIndex = cutoffIndex + 1
      }

      if (retainStartIndex >= 1 && retainStartIndex <= messages.length - 1) {
        const cleanSummary = normalizeCompressionOutput(snapshot.summaryText, '').summaryText
        const summaryMsg: MessageWithParts = {
          id: 'snapshot_' + snapshot.id,
          sessionId,
          role: 'system',
          isSummary: true,
          orderIndex: -1,
          createdAt: snapshot.createdAt ?? new Date(),
          parts: [
            {
              id: 'p_snapshot_' + snapshot.id,
              messageId: 'snapshot_' + snapshot.id,
              sessionId,
              type: 'text',
              data: { text: `[往期对话摘要压缩]：\n${cleanSummary}` }
            }
          ]
        }
        effectiveMessages = [summaryMsg, ...messages.slice(retainStartIndex)]
      } else {
        effectiveMessages = [...messages]
      }
    } else {
      effectiveMessages = [...messages]
    }

    if (config.recentCount <= 0) {
      return effectiveMessages
    }

    let startIndex = 0
    let rounds = 0

    for (let i = effectiveMessages.length - 1; i >= 0; i--) {
      const msg = effectiveMessages[i]!
      const nextMsgInTimeline = i < effectiveMessages.length - 1 ? effectiveMessages[i + 1] : null
      const isUser = msg.role === 'user'

      if (isUser && (!nextMsgInTimeline || nextMsgInTimeline.role !== 'user')) {
        rounds++
      }

      if (rounds === config.recentCount && isUser) {
        startIndex = i
      } else if (rounds > config.recentCount) {
        break
      }
    }

    if (snapshot && startIndex > 0) {
      startIndex = Math.max(1, startIndex)
    }

    while (
      startIndex > 0 &&
      startIndex < effectiveMessages.length &&
      effectiveMessages[startIndex]!.role === 'tool'
    ) {
      startIndex--
    }

    startIndex = Math.max(0, startIndex)

    if (snapshot && startIndex > 0) {
      return [effectiveMessages[0]!, ...effectiveMessages.slice(startIndex)]
    }

    return effectiveMessages.slice(startIndex)
  }
}
