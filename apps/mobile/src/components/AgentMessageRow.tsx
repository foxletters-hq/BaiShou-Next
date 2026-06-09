import React from 'react'
import { View, StyleSheet } from 'react-native'
import { ChatBubble, CompressionActivityBar, CompressionDivider } from '@baishou/ui/native'
import type { CompactionMarkerData } from '@baishou/ai'

type ChatMessage = {
  id: string
  role: string
  content: string
  reasoning?: string
  toolInvocations?: unknown[]
  attachments?: unknown[]
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
  compactionRecord?: CompactionMarkerData | null
}

export interface AgentMessageRowProps {
  item: ChatMessage
  chatUserProfile: { nickname: string; avatarPath?: string | null }
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
}

export const AgentMessageRow: React.FC<AgentMessageRowProps> = ({
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
  onBubbleEditingChange
}) => {
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

  const showDivider =
    showPersistedCompression && persistedCompaction?.status !== 'failed'

  return (
    <View style={styles.row}>
      <ChatBubble
        message={{
          id: item.id,
          role: item.role as 'user' | 'assistant',
          content: item.content,
          reasoning: item.reasoning,
          toolInvocations: item.toolInvocations,
          attachments: item.attachments,
          inputTokens: item.inputTokens,
          outputTokens: item.outputTokens,
          costMicros: item.costMicros
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
}

const styles = StyleSheet.create({
  row: {
    width: '100%'
  },
  compressionBlock: {
    width: '100%'
  }
})
