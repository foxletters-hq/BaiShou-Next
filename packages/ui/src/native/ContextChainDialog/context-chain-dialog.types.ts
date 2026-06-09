export interface MockChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
  toolInvocations?: unknown[]
}

import type { CallChainFlatEntry, CallChainPanelMeta } from './context-chain-panel.types'

export interface NativeContextChainDialogProps {
  isOpen: boolean
  onClose: () => void
  message: MockChatMessage
  /** 旧版扁平消息列表（无 flatEntries 时回退） */
  contextMessages?: MockChatMessage[]
  /** 对齐桌面 ContextChainPanel 的调用链条目 */
  flatEntries?: CallChainFlatEntry[]
  meta?: CallChainPanelMeta
  compressedContent?: string
  originalContent?: string
  systemPrompt?: string
}

export type ContextChainTab = 'context' | 'compressed' | 'original' | 'prompt'

export interface ContextChainTabItem {
  key: ContextChainTab
  label: string
}
