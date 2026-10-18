import React from 'react'
import { View, StyleSheet } from 'react-native'
import {
  ChatBubble,
  CompressionActivityBar,
  CompressionDivider,
  type NativeChatLiveStream
} from '@baishou/ui/native'
import type { CompactionMarkerData } from '@baishou/ai'

type ChatMessage = {
  id: string
  role: string
  content: string
  reasoning?: string
  timestamp?: Date
  toolInvocations?: unknown[]
  attachments?: any[]
  skillRefs?: Array<{ command: string; content: string }>
  fileRefs?: unknown[]
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
  costMicros?: number
  compactionRecord?: CompactionMarkerData | null
  parts?: Array<{ type?: string; id?: string; data?: unknown }>
}

export interface AgentMessageRowProps {
  item: ChatMessage
  chatUserProfile: {
    nickname: string
    avatarPath?: string | null
    resolvedAvatarUri?: string | null
  }
  chatAiProfile: {
    name: string
    emoji?: string | null
    avatarPath?: string | null
    resolvedAvatarUri?: string | null
  }
  isLiveCompressionAnchor: boolean
  liveCompression: {
    phase: 'auto' | 'manual'
    summary: string
    reasoning: string
    isActive: boolean
  }
  onRegenerate: () => void
  onResend?: () => void
  onResendEdit?: (content: string) => void
  onSaveEdit?: (content: string) => void
  onCopy: () => void
  onDelete: () => void
  onReadAloud?: () => void
  isTtsPlaying?: boolean
  onShowContext?: () => void
  onBranch?: () => void
  onBubbleEditingChange?: (editing: boolean, messageId?: string) => void
  invertMetaOverBackground?: 'light' | 'dark' | boolean
  hasChatBackground?: boolean
  retryDisabled?: boolean
  liveStream?: NativeChatLiveStream
  error?: string | null
  deferAssistantChrome?: boolean
}

function areAgentMessageRowPropsEqual(
  prev: AgentMessageRowProps,
  next: AgentMessageRowProps
): boolean {
  if (prev.liveStream !== next.liveStream) return false
  if (prev.deferAssistantChrome !== next.deferAssistantChrome) return false
  if (prev.isLiveCompressionAnchor !== next.isLiveCompressionAnchor) return false
  if (prev.liveCompression !== next.liveCompression) return false
  if (prev.isTtsPlaying !== next.isTtsPlaying) return false
  if (prev.invertMetaOverBackground !== next.invertMetaOverBackground) return false
  if (prev.hasChatBackground !== next.hasChatBackground) return false
  if (prev.retryDisabled !== next.retryDisabled) return false
  if (prev.error !== next.error) return false
  if (prev.chatUserProfile !== next.chatUserProfile) return false
  if (prev.chatAiProfile !== next.chatAiProfile) return false

  if (prev.item === next.item) return true

  return (
    prev.item.id === next.item.id &&
    prev.item.role === next.item.role &&
    prev.item.content === next.item.content &&
    prev.item.reasoning === next.item.reasoning &&
    prev.item.inputTokens === next.item.inputTokens &&
    prev.item.outputTokens === next.item.outputTokens &&
    prev.item.cacheReadInputTokens === next.item.cacheReadInputTokens &&
    prev.item.cacheWriteInputTokens === next.item.cacheWriteInputTokens &&
    prev.item.costMicros === next.item.costMicros &&
    (prev.item.parts?.length ?? 0) === (next.item.parts?.length ?? 0) &&
    (prev.item.toolInvocations?.length ?? 0) === (next.item.toolInvocations?.length ?? 0) &&
    (prev.item.attachments?.length ?? 0) === (next.item.attachments?.length ?? 0) &&
    prev.item.compactionRecord?.status === next.item.compactionRecord?.status &&
    prev.item.compactionRecord?.streamTranscript === next.item.compactionRecord?.streamTranscript &&
    prev.item.compactionRecord?.streamReasoning === next.item.compactionRecord?.streamReasoning
  )
}

export const AgentMessageRow = React.memo(function AgentMessageRow({
  item,
  chatUserProfile,
  chatAiProfile,
  isLiveCompressionAnchor,
  liveCompression,
  onRegenerate,
  onResend,
  onResendEdit,
  onSaveEdit,
  onCopy,
  onDelete,
  onReadAloud,
  isTtsPlaying,
  onShowContext,
  onBranch,
  onBubbleEditingChange,
  invertMetaOverBackground = false,
  hasChatBackground = false,
  retryDisabled = false,
  liveStream,
  deferAssistantChrome = false,
  error = null
}: AgentMessageRowProps) {
  const persistedCompaction =
    item.role === 'user' && item.compactionRecord ? item.compactionRecord : null

  const hasPersistedCompressionContent = Boolean(
    persistedCompaction &&
    persistedCompaction.status !== 'failed' &&
    (Boolean(persistedCompaction.streamTranscript?.trim()) ||
      Boolean(persistedCompaction.streamReasoning?.trim()))
  )

  const showLiveCompression = isLiveCompressionAnchor
  const showPersistedCompression = !showLiveCompression && hasPersistedCompressionContent

  const compactionSummary = showLiveCompression
    ? liveCompression.summary
    : (persistedCompaction?.streamTranscript ?? '')

  const compactionReasoning = showLiveCompression
    ? liveCompression.reasoning
    : (persistedCompaction?.streamReasoning ?? '')

  const compactionPhase = showLiveCompression
    ? liveCompression.phase
    : (persistedCompaction?.phase ?? 'auto')

  const showDivider = showPersistedCompression && persistedCompaction?.status !== 'failed'

  return (
    <View style={styles.row}>
      <ChatBubble
        message={{
          id: item.id,
          role: item.role as 'user' | 'assistant',
          content: item.content,
          reasoning: item.reasoning,
          timestamp: item.timestamp,
          toolInvocations: item.toolInvocations,
          attachments: item.attachments,
          skillRefs: item.skillRefs,
          fileRefs: item.fileRefs as any,
          inputTokens: item.inputTokens,
          outputTokens: item.outputTokens,
          cacheReadInputTokens: item.cacheReadInputTokens,
          cacheWriteInputTokens: item.cacheWriteInputTokens,
          costMicros: item.costMicros,
          parts: item.parts
        }}
        userProfile={chatUserProfile}
        aiProfile={chatAiProfile}
        onRegenerate={onRegenerate}
        onResend={onResend}
        onResendEdit={onResendEdit}
        onSaveEdit={onSaveEdit}
        onCopy={onCopy}
        onDelete={onDelete}
        onReadAloud={onReadAloud}
        isTtsPlaying={isTtsPlaying}
        onShowContext={onShowContext}
        onBranch={onBranch}
        onEditingChange={onBubbleEditingChange}
        invertMetaOverBackground={invertMetaOverBackground || hasChatBackground}
        hasChatBackground={Boolean(hasChatBackground || invertMetaOverBackground)}
        retryDisabled={retryDisabled}
        liveStream={liveStream}
        deferAssistantChrome={deferAssistantChrome}
        error={error}
      />

      {(showLiveCompression || showPersistedCompression) && (
        <View style={styles.compressionBlock}>
          <CompressionActivityBar
            phase={compactionPhase}
            summary={compactionSummary}
            reasoning={compactionReasoning}
            isActive={showLiveCompression ? liveCompression.isActive : false}
            thoughtDurationMs={persistedCompaction?.thoughtDurationMs}
            summaryDurationMs={persistedCompaction?.summaryDurationMs}
          />
          {showDivider ? <CompressionDivider /> : null}
        </View>
      )}
    </View>
  )
}, areAgentMessageRowPropsEqual)

const styles = StyleSheet.create({
  row: {
    width: '100%'
  },
  compressionBlock: {
    width: '100%'
  }
})
