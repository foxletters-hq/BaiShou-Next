import React from 'react'
import { ContextChainDialog as SharedContextChainDialog } from '@baishou/ui/native'
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
  contextMessages: Array<{
    role: string
    content: string
    timestamp?: Date
  }>
  compressedContent?: string
  originalContent?: string
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

  const adaptedContextMessages: MockChatMessage[] = props.contextMessages.map((msg, i) => ({
    id: `ctx-${i}`,
    role: msg.role as MockChatMessage['role'],
    content: msg.content
  }))

  return (
    <SharedContextChainDialog
      isOpen={props.visible}
      onClose={props.onClose}
      message={adaptedMessage}
      contextMessages={adaptedContextMessages}
      compressedContent={props.compressedContent}
      originalContent={props.originalContent}
      systemPrompt={props.systemPrompt}
    />
  )
}
