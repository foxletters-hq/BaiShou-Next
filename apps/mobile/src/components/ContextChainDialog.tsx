import React from 'react'
import {
  ContextChainDialog as SharedContextChainDialog,
  type CallChainFlatEntry,
  type CallChainPanelMeta
} from '@baishou/ui/native'
import type { MockChatMessage } from '@baishou/ui/native'

export interface ContextChainDialogProps {
  visible: boolean
  onClose: () => void
  message: {
    id?: string
    role?: string
    content?: string
    inputTokens?: number
    outputTokens?: number
    cacheReadInputTokens?: number
    cacheWriteInputTokens?: number
    costMicros?: number
  }
  flatEntries?: CallChainFlatEntry[]
  meta?: CallChainPanelMeta
  compressedContent?: string
  systemPrompt?: string
  sessionId?: string
  recompressBusy?: boolean
  recompressStartedAt?: number
  recompressStreamText?: string
  recompressStreamReasoning?: string
  recompressError?: string | null
  onRecompress?: () => void
  onRecompressDismissError?: () => void
}

export const ContextChainDialog: React.FC<ContextChainDialogProps> = (props) => {
  const adaptedMessage: MockChatMessage = {
    id: props.message.id || '',
    role: (props.message.role as MockChatMessage['role']) || 'assistant',
    content: props.message.content || '',
    inputTokens: props.message.inputTokens,
    outputTokens: props.message.outputTokens,
    cacheReadInputTokens: props.message.cacheReadInputTokens,
    cacheWriteInputTokens: props.message.cacheWriteInputTokens,
    costMicros: props.message.costMicros
  }

  return (
    <SharedContextChainDialog
      isOpen={props.visible}
      onClose={props.onClose}
      message={adaptedMessage}
      flatEntries={props.flatEntries}
      meta={props.meta}
      compressedContent={props.compressedContent}
      systemPrompt={props.systemPrompt}
      sessionId={props.sessionId}
      recompressBusy={props.recompressBusy}
      recompressStartedAt={props.recompressStartedAt}
      recompressStreamText={props.recompressStreamText}
      recompressStreamReasoning={props.recompressStreamReasoning}
      recompressError={props.recompressError}
      onRecompress={props.onRecompress}
      onRecompressDismissError={props.onRecompressDismissError}
    />
  )
}
