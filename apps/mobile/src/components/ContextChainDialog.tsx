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
    costMicros?: number
  }
  flatEntries?: CallChainFlatEntry[]
  meta?: CallChainPanelMeta
  compressedContent?: string
  systemPrompt?: string
}

export const ContextChainDialog: React.FC<ContextChainDialogProps> = (props) => {
  const adaptedMessage: MockChatMessage = {
    id: props.message.id || '',
    role: (props.message.role as MockChatMessage['role']) || 'assistant',
    content: props.message.content || '',
    inputTokens: props.message.inputTokens,
    outputTokens: props.message.outputTokens,
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
    />
  )
}
