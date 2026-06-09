import type { MockChatMessage } from './context-chain-dialog.types'

export interface CallChainFlatEntry {
  kind: 'system-prompt' | 'compression-summary' | 'round-header' | 'message'
  roundIndex?: number
  summaryText?: string
  reasoningText?: string
  item?: MockChatMessage & { label?: string }
}

export interface CallChainRoundGroup {
  roundIndex: number
  messages: Array<
    CallChainFlatEntry & { kind: 'message'; item: MockChatMessage & { label?: string } }
  >
}

export interface CallChainPanelMeta {
  nextRequest?: {
    estimatedInputTokens: number
    contextRoundLimit: number
    contextRoundCount: number
  }
  roundUsage?: {
    inputTokens: number
    outputTokens: number
    costMicros: number
  } | null
  activeRoundIndex?: number
}
