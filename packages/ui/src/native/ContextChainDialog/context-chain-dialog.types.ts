export interface MockChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
  toolInvocations?: unknown[]
}

export interface NativeContextChainDialogProps {
  isOpen: boolean
  onClose: () => void
  message: MockChatMessage
  contextMessages: MockChatMessage[]
  compressedContent?: string
  originalContent?: string
  systemPrompt?: string
}

export type ContextChainTab = 'context' | 'compressed' | 'original' | 'prompt'

export interface ContextChainTabItem {
  key: ContextChainTab
  label: string
}
