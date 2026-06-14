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
    // 拿大范围或者拿全部。因历史库非常长可能卡顿我们用极值限制一下
    // 注意 getMessagesBySession 内部倒序取并 reverse 原样返还，所以它是从旧到新的
    let rawMessages = (await sessionRepo.getMessagesBySession(
      sessionId,
      COMPRESSION_MESSAGE_FETCH_LIMIT
    )) as MessageWithParts[]
    if (rawMessages.length === 0) return []

    if (config.upToOrderIndex !== undefined) {
      rawMessages = rawMessages.filter((m) => m.orderIndex <= config.upToOrderIndex!)
    }
    if (rawMessages.length === 0) return []

    let effectiveMessages: MessageWithParts[] = []

    // 1. 挂接记忆 Snapshot 快照
    const snapshot = await snapshotRepo.getLatestSnapshot(sessionId)
    if (snapshot) {
      // 优先使用显式保留区起点（tail_start_message_id）；缺失时回退到 coveredUpTo+1
      let retainStartIndex = -1
      if (snapshot.tailStartMessageId) {
        retainStartIndex = rawMessages.findIndex((m) => m.id === snapshot.tailStartMessageId)
      }
      if (retainStartIndex < 0) {
        const cutoffIndex = resolveSnapshotCutoffIndex(rawMessages, snapshot)
        if (cutoffIndex >= 0) retainStartIndex = cutoffIndex + 1
      }

      if (retainStartIndex >= 1 && retainStartIndex <= rawMessages.length - 1) {
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
        effectiveMessages = [summaryMsg, ...rawMessages.slice(retainStartIndex)]
      } else {
        effectiveMessages = [...rawMessages]
      }
    } else {
      effectiveMessages = [...rawMessages]
    }

    // 2. 滑动窗口：按“对话轮数”截断（一轮 = 用户消息 + 该轮 AI 回复与工具调用）
    // recentCount <= 0 表示不截断（除 Snapshot 外）
    if (config.recentCount <= 0) {
      return effectiveMessages
    }

    let startIndex = 0
    let rounds = 0

    for (let i = effectiveMessages.length - 1; i >= 0; i--) {
      const msg = effectiveMessages[i]!
      const nextMsgInTimeline = i < effectiveMessages.length - 1 ? effectiveMessages[i + 1] : null
      const isUser = msg.role === 'user'

      // 视一个或连续多个 user 消息为同一轮对话的起点
      if (isUser && (!nextMsgInTimeline || nextMsgInTimeline.role !== 'user')) {
        rounds++
      }

      if (rounds === config.recentCount && isUser) {
        // 所属目标轮的 user 消息，将其纳入起点
        startIndex = i
      } else if (rounds > config.recentCount) {
        // 超出目标轮数，结束搜索
        break
      }
    }

    // 假设首条已被刚才注入了 Summary System，死保它！
    if (snapshot && startIndex > 0) {
      startIndex = Math.max(1, startIndex) // 保证不能切到底 0 (0是summary)
    }

    // 3. 安全退行逻辑：保证如果 startIndex 指向了一条悬空的 tool result 或没结束的 tool call 给退到正常的起点
    // Vercel AI SDK 极其严格，如果你给它发一个 { role: 'tool', ... } 但是前面并没有它对应的主脑 { role: 'assistant', call }，一定报错。
    while (
      startIndex > 0 &&
      startIndex < effectiveMessages.length &&
      // 如果头是 tool result 必须要带上属于它的 assistant call (它的上一条或者上面若干条)
      effectiveMessages[startIndex]!.role === 'tool'
    ) {
      startIndex--
    }
    // 进一步安全：如果 startIndex 现在是 assistant，我们要确保它本身不是只有 call（通常如果是正常的结束它就是发 tool call，下一句马上接 tool result。我们应该把从它产生的连续请求都框进来）
    // 但倒退回去时，如果是 assistant 发起的工具，倒退它自身没问题！

    startIndex = Math.max(0, startIndex)

    if (snapshot && startIndex > 0) {
      return [effectiveMessages[0]!, ...effectiveMessages.slice(startIndex)]
    }

    return effectiveMessages.slice(startIndex)
  }
}
