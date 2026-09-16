import type { MockChatMessage } from '@baishou/shared'
import type { CallChainFlatEntry, CallChainPanelMeta } from '@baishou/ui'
import {
  getWorkspaceAssistantText,
  getWorkspaceUserText
} from './workspace-message-display.util'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'

export type WorkspaceContextViewModelEntry = {
  kind: 'round-header' | 'compression-summary' | 'system-prompt' | 'message'
  roundIndex?: number
  summaryText?: string
  reasoningText?: string
  item?: {
    role?: string
    content?: string
    label?: string
    attachments?: MockChatMessage['attachments']
  }
}

export type WorkspaceContextAtMessageResult = {
  systemPrompt?: string
  compressedContent?: string
  viewModel?: {
    flatEntries?: WorkspaceContextViewModelEntry[]
    nextRequest?: CallChainPanelMeta['nextRequest']
    roundUsage?: CallChainPanelMeta['roundUsage']
    activeRoundIndex?: number
    compressionReasoning?: string
  }
}

export type WorkspaceContextChainState = {
  message: MockChatMessage
  flatEntries: CallChainFlatEntry[]
  compressedContent: string
  systemPrompt: string
  meta: CallChainPanelMeta
}

function asChatRole(role: string | undefined): MockChatMessage['role'] {
  if (role === 'user' || role === 'system' || role === 'tool') return role
  return 'assistant'
}

export function toWorkspaceContextBubbleMessage(
  source: WorkspaceChatMessage,
  sessionId: string
): MockChatMessage {
  const role = source.role === 'user' ? 'user' : 'assistant'
  const content =
    role === 'user' ? getWorkspaceUserText(source) : getWorkspaceAssistantText(source)
  return {
    id: source.id,
    sessionId,
    role,
    content,
    reasoning: source.reasoning,
    timestamp: source.createdAt ? new Date(source.createdAt) : new Date(),
    inputTokens: source.inputTokens,
    outputTokens: source.outputTokens,
    cacheReadInputTokens: source.cacheReadInputTokens,
    cacheWriteInputTokens: source.cacheWriteInputTokens
  }
}

function mapViewModelEntry(
  entry: WorkspaceContextViewModelEntry,
  index: number,
  options: {
    sessionId: string
    sourceMessageId: string
    systemPromptLabel: string
    timestamp: Date
    compressedContent?: string
    compressionReasoning?: string
  }
): CallChainFlatEntry {
  if (entry.kind === 'round-header') {
    return { kind: 'round-header', roundIndex: entry.roundIndex }
  }
  if (entry.kind === 'compression-summary') {
    return {
      kind: 'compression-summary',
      summaryText: entry.summaryText ?? options.compressedContent ?? '',
      reasoningText: entry.reasoningText ?? options.compressionReasoning ?? ''
    }
  }
  if (entry.kind === 'system-prompt') {
    return {
      kind: 'system-prompt',
      item: {
        id: `ctx-sys-${options.sourceMessageId}`,
        sessionId: options.sessionId,
        role: 'system',
        content: entry.item?.content ?? '',
        label: entry.item?.label ?? options.systemPromptLabel,
        timestamp: options.timestamp
      }
    }
  }
  return {
    kind: 'message',
    roundIndex: entry.roundIndex,
    item: {
      id: `ctx-${options.sourceMessageId}-${index}`,
      sessionId: options.sessionId,
      role: asChatRole(entry.item?.role),
      content: entry.item?.content,
      label: entry.item?.label,
      attachments: entry.item?.attachments,
      timestamp: options.timestamp
    }
  }
}

/** 把 `agent:get-context-at-message` 的 viewModel 收成 ContextChainPanel 需要的结构。 */
export function mapWorkspaceContextAtMessage(
  result: WorkspaceContextAtMessageResult | null | undefined,
  options: {
    fallbackMessage: MockChatMessage
    sessionId: string
    sourceMessageId: string
    systemPromptLabel: string
    timestamp: Date
  }
): WorkspaceContextChainState | null {
  if (!result) return null
  const flatEntries = (result.viewModel?.flatEntries ?? []).map((entry, index) =>
    mapViewModelEntry(entry, index, {
      sessionId: options.sessionId,
      sourceMessageId: options.sourceMessageId,
      systemPromptLabel: options.systemPromptLabel,
      timestamp: options.timestamp,
      compressedContent: result.compressedContent,
      compressionReasoning: result.viewModel?.compressionReasoning
    })
  )
  return {
    message: options.fallbackMessage,
    flatEntries,
    compressedContent: result.compressedContent ?? '',
    systemPrompt: result.systemPrompt ?? '',
    meta: {
      nextRequest: result.viewModel?.nextRequest,
      roundUsage: result.viewModel?.roundUsage ?? null,
      activeRoundIndex: result.viewModel?.activeRoundIndex
    }
  }
}
