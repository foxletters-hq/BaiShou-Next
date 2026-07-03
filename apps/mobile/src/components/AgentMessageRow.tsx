import React from 'react'
import { View, Image, Text, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import {
  ChatBubble,
  CompressionActivityBar,
  CompressionDivider,
  resolveNativeAssistantAvatarSource,
  shouldShowAssistantEmoji
} from '@baishou/ui/native'
import type { CompactionMarkerData } from '@baishou/ai'

type ChatMessage = {
  id: string
  role: string
  content: string
  reasoning?: string
  toolInvocations?: unknown[]
  attachments?: any[]
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
  costMicros?: number
  compactionRecord?: CompactionMarkerData | null
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
  invertMetaOverBackground?: boolean
  retryDisabled?: boolean
  liveStream?: {
    content?: string
    reasoning?: string
    isTextStreaming?: boolean
    isThinkStreaming?: boolean
    activeToolName?: string | null
    completedTools?: Array<{
      name: string
      durationMs: number
      toolCallId?: string
      result?: unknown
      args?: unknown
    }>
  }
  deferAssistantChrome?: boolean
}

/**
 * 判断一条消息是否为纯表情包消息：
 * assistant 角色、有图片附件、没有文本/推理/工具调用
 */
function isEmojiOnlyMessage(item: ChatMessage): boolean {
  if (item.role !== 'assistant') return false
  const hasAttachments = item.attachments && item.attachments.length > 0
  if (!hasAttachments) return false
  const allImageAttachments = item.attachments!.every((att: any) => att.isImage)
  if (!allImageAttachments) return false
  const hasText = Boolean(item.content?.trim())
  const hasReasoning = Boolean(item.reasoning?.trim())
  const hasToolInvocations = item.toolInvocations && item.toolInvocations.length > 0
  if (hasText || hasReasoning || hasToolInvocations) return false
  return true
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
  retryDisabled = false,
  liveStream,
  deferAssistantChrome = false
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

  const emojiOnly = isEmojiOnlyMessage(item)

  return (
    <View style={styles.row}>
      {emojiOnly ? (
        // 纯表情包消息：头像 + 裸图片，不包裹 ChatBubble
        <View style={styles.emojiOnlyRow}>
          <View style={styles.emojiOnlyAvatar}>
            {shouldShowAssistantEmoji(chatAiProfile.avatarPath, chatAiProfile.resolvedAvatarUri, chatAiProfile.emoji) ? (
              <View style={styles.emojiOnlyAvatarFallback}>
                <Text style={styles.emojiOnlyAvatarText}>
                  {chatAiProfile.emoji || '🤖'}
                </Text>
              </View>
            ) : (
              <Image
                source={resolveNativeAssistantAvatarSource(chatAiProfile.avatarPath, chatAiProfile.resolvedAvatarUri)}
                style={styles.emojiOnlyAvatarImg}
              />
            )}
          </View>
          <View style={styles.emojiOnlyImages}>
            {item.attachments!.map((att: any, idx: number) => (
              <Image
                key={`emoji-${item.id}-${idx}`}
                source={{ uri: att.filePath || att.url }}
                style={styles.emojiOnlyImg}
                resizeMode="contain"
              />
            ))}
          </View>
        </View>
      ) : (
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
            cacheReadInputTokens: item.cacheReadInputTokens,
            cacheWriteInputTokens: item.cacheWriteInputTokens,
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
          invertMetaOverBackground={invertMetaOverBackground}
          retryDisabled={retryDisabled}
          liveStream={liveStream}
          deferAssistantChrome={deferAssistantChrome}
        />
      )}

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
})

const styles = StyleSheet.create({
  row: {
    width: '100%'
  },
  compressionBlock: {
    width: '100%'
  },
  emojiOnlyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8
  },
  emojiOnlyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0
  },
  emojiOnlyAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  emojiOnlyAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)'
  },
  emojiOnlyAvatarText: {
    fontSize: 14
  },
  emojiOnlyImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flexShrink: 1
  },
  emojiOnlyImg: {
    width: 120,
    height: 120,
    borderRadius: 8
  }
})