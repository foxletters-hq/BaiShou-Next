import { SessionRepository } from '@baishou/database'
import { SnapshotRepository } from '@baishou/database'
import type { ModelMessage } from 'ai'
import { ContextWindowBuilder } from './context-window.builder'
import { MessageAdapter } from './message.adapter'
import {
  formatModelMessagesForDisplay,
  type DisplayContextMessage
} from './model-message-display.formatter'
import { ContextCallChainBuilder } from './context-call-chain.builder'
import { buildCallChainViewModel, type CallChainViewModel } from './call-chain-view-model.builder'
import { normalizeCompressionOutput } from '@baishou/shared'
import { resolveSnapshotCutoffIndex } from './context-compression.utils'
import type { MessageWithParts } from './message.adapter'
import { resolveCompactionReasoningForSnapshot, resolveCompactionDurationsForSnapshot } from './compaction-marker'

export interface ContextAtMessageOptions {
  recentCount: number
  modelId?: string
  providerType?: string
  systemPrompt?: string
}

export interface ContextAtMessageResult {
  messages: DisplayContextMessage[]
  systemPrompt: string
  compressedContent?: string
  viewModel: CallChainViewModel
}

export class ContextAtMessageService {
  /**
   * 根据消息 ID 还原该轮对话发送给 AI 的完整上下文（含 user / assistant / tool）。
   */
  static async getContextAtMessage(
    sessionId: string,
    messageId: string,
    sessionRepo: SessionRepository,
    snapshotRepo: SnapshotRepository,
    options: ContextAtMessageOptions
  ): Promise<ContextAtMessageResult> {
    const { COMPRESSION_MESSAGE_FETCH_LIMIT } = await import('./compression.constants')
    const allMessages = await sessionRepo.getMessagesBySession(
      sessionId,
      COMPRESSION_MESSAGE_FETCH_LIMIT
    )
    const target = allMessages.find((m) => m.id === messageId)
    if (!target) {
      const emptyVm = buildCallChainViewModel({
        chain: [],
        systemPrompt: options.systemPrompt ?? '',
        recentCount: options.recentCount,
        target: { role: 'user', orderIndex: 0 },
        allMessages: []
      })
      return {
        messages: [],
        systemPrompt: options.systemPrompt ?? '',
        viewModel: emptyVm
      }
    }

    const upToOrderIndex = this.resolveUpToOrderIndex(
      target.role,
      target.orderIndex,
      allMessages
    )

    const dbHistory = await ContextWindowBuilder.build(sessionId, sessionRepo, snapshotRepo, {
      recentCount: options.recentCount,
      upToOrderIndex
    })

    const modelMessages = await MessageAdapter.toVercelMessages(
      dbHistory,
      options.modelId,
      options.providerType
    )

    const { chain, compressedContent, systemPrompt } = ContextCallChainBuilder.build({
      systemPrompt: options.systemPrompt,
      modelMessages,
      target: target as any,
      allMessages: allMessages as any
    })

    const latestSnapshot = await snapshotRepo.getLatestSnapshot(sessionId)
    const compactionMeta = ContextAtMessageService.resolveCompactionMeta(
      allMessages as MessageWithParts[],
      latestSnapshot
    )

    const viewModel = buildCallChainViewModel({
      chain,
      systemPrompt,
      recentCount: options.recentCount,
      target: {
        role: target.role,
        orderIndex: target.orderIndex,
        id: target.id,
        inputTokens: target.inputTokens ?? undefined,
        outputTokens: target.outputTokens ?? undefined,
        costMicros: target.costMicros ?? undefined
      },
      allMessages: allMessages as any,
      compressionSummary: compactionMeta.compressionSummary,
      compressionReasoning: compactionMeta.compressionReasoning,
      compactionCutoffOrderIndex: compactionMeta.compactionCutoffOrderIndex,
      thoughtDurationMs: compactionMeta.thoughtDurationMs,
      summaryDurationMs: compactionMeta.summaryDurationMs,
      windowMessages: dbHistory
    })

    return {
      messages: chain,
      systemPrompt,
      compressedContent: viewModel.compressionSummary ?? compressedContent,
      viewModel
    }
  }

  /**
   * 用户消息：包含该条用户消息本身。
   * 助手消息：包含触发该回复的最后一条用户消息及之前的上下文。
   */
  static resolveUpToOrderIndex(
    targetRole: string,
    targetOrderIndex: number,
    allMessages: Array<{ role: string; orderIndex: number }>
  ): number {
    if (targetRole === 'user') {
      return targetOrderIndex
    }

    for (let i = allMessages.length - 1; i >= 0; i--) {
      const m = allMessages[i]!
      if (m.orderIndex < targetOrderIndex && m.role === 'user') {
        return m.orderIndex
      }
    }

    return Math.max(0, targetOrderIndex - 1)
  }

  /** @internal 供测试使用 */
  static formatMessages(messages: ModelMessage[]): DisplayContextMessage[] {
    return formatModelMessagesForDisplay(messages)
  }

  static resolveCompactionMeta(
    allMessages: MessageWithParts[],
    snapshot: {
      id: number
      summaryText: string
      coveredUpToMessageId: string
      tailStartMessageId?: string | null
    } | null
  ): {
    compressionSummary?: string
    compressionReasoning?: string
    compactionCutoffOrderIndex?: number
    thoughtDurationMs?: number
    summaryDurationMs?: number
  } {
    if (!snapshot?.summaryText?.trim()) {
      return {}
    }

    const compressionSummary = normalizeCompressionOutput(snapshot.summaryText, '').summaryText
    const compressionReasoning = resolveCompactionReasoningForSnapshot(allMessages, snapshot.id)
    const durations = resolveCompactionDurationsForSnapshot(allMessages, snapshot.id)

    if (snapshot.tailStartMessageId) {
      const tailIdx = allMessages.findIndex((m) => m.id === snapshot.tailStartMessageId)
      if (tailIdx > 0) {
        const anchor = allMessages[tailIdx - 1]
        return {
          compressionSummary,
          compressionReasoning,
          compactionCutoffOrderIndex: anchor?.orderIndex,
          thoughtDurationMs: durations.thoughtDurationMs,
          summaryDurationMs: durations.summaryDurationMs
        }
      }
    }

    const cutoffIndex = resolveSnapshotCutoffIndex(allMessages, snapshot)
    const anchor = cutoffIndex >= 0 ? allMessages[cutoffIndex] : undefined
    const orderFallback = Number(snapshot.coveredUpToMessageId)
    const compactionCutoffOrderIndex =
      anchor?.orderIndex ?? (!Number.isNaN(orderFallback) ? orderFallback : undefined)

    return {
      compressionSummary,
      compressionReasoning,
      compactionCutoffOrderIndex,
      thoughtDurationMs: durations.thoughtDurationMs,
      summaryDurationMs: durations.summaryDurationMs
    }
  }
}
