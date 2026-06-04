import type { MockChatMessage } from '@baishou/shared'

export interface CallChainFlatEntry {
  kind: 'system-prompt' | 'compression-summary' | 'round-header' | 'message'
  roundIndex?: number
  summaryText?: string
  reasoningText?: string
  item?: MockChatMessage & { label?: string }
  thoughtDurationMs?: number
  summaryDurationMs?: number
}

export interface CallChainRoundGroup {
  roundIndex: number
  messages: Array<
    CallChainFlatEntry & { kind: 'message'; item: MockChatMessage & { label?: string } }
  >
}
