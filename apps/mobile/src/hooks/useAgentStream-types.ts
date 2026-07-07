import type { MutableRefObject } from 'react'
import type { StreamingTextDisplayBuffer } from '@baishou/shared'
import type { useBaishou } from '../providers/BaishouProvider'

export const MOBILE_AGENT_STREAM_DISPLAY_OPTIONS = {
  immediate: true
} as const

export const STREAM_PRESENTATION_LINGER_MS = 520
export const STREAM_BUFFER_HOLD_AFTER_LINGER_MS = 320
export const STREAM_ZERO_OUTPUT_NETWORK_RETRIES = 2

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
  totalCostMicros: number
}

export interface ToolCallInfo {
  name: string
  startTime: number
  endTime?: number
  result?: unknown
  toolCallId?: string
}

export interface PendingEmoji {
  emojiId: string
}

export type RefreshSessionMessagesFn = (
  sessionId: string,
  options?: {
    preserveWindow?: boolean
    retryCount?: number
    waitForLatestUsage?: boolean
    commitToUi?: boolean
  }
) => Promise<boolean>

export type StartAgentChatFn = NonNullable<ReturnType<typeof useBaishou>['startAgentChat']>
export type AgentStreamOverrides = NonNullable<Parameters<StartAgentChatFn>[3]>

export interface AgentStreamRefs {
  searchModeRef: MutableRefObject<boolean | undefined>
  streamAbortRef: MutableRefObject<(() => void) | null>
  retryEpochRef: MutableRefObject<number>
  activeToolRef: MutableRefObject<ToolCallInfo | null>
  currentSessionIdRef: MutableRefObject<string | null>
  streamingTextDisplayRef: MutableRefObject<StreamingTextDisplayBuffer | null>
  streamingReasoningDisplayRef: MutableRefObject<StreamingTextDisplayBuffer | null>
  compressionTextDisplayRef: MutableRefObject<StreamingTextDisplayBuffer | null>
  compressionReasoningDisplayRef: MutableRefObject<StreamingTextDisplayBuffer | null>
  streamFinalizeLockRef: MutableRefObject<string | null>
  finishStreamPassRef: MutableRefObject<number>
  isStreamingRef: MutableRefObject<boolean>
  isStreamBridgeActiveRef: MutableRefObject<boolean>
  streamPresentationLingerRef: MutableRefObject<boolean>
  reloadInFlightRef: MutableRefObject<Promise<boolean> | null>
  retryActionInFlightRef: MutableRefObject<boolean>
  pendingRetryReleaseEpochRef: MutableRefObject<number | null>
  userStoppedStreamRef: MutableRefObject<boolean>
  streamBridgeReleaseTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  streamPresentationLingerTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  streamBufferHoldTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  streamAttemptErrorRef: MutableRefObject<string | null>
  completedToolsCountRef: MutableRefObject<number>
  finishStreamInFlightRef: MutableRefObject<Promise<void> | null>
}

export const EMPTY_TOKEN_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheWriteInputTokens: 0,
  totalCostMicros: 0
}
