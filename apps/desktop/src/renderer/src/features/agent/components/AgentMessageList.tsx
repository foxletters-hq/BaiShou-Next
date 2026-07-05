import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { mapAttachmentsFromParts, resolveAttachmentImageSrc, normalizeEmojiToolConfig, resolveAssistantEmojiConfig, assistantRowToEmojiPrefs } from '@baishou/shared'
import {
  ChatBubble,
  StreamingBubble,
  CompressionDivider,
  CompressionActivityBar,
  resolveActiveToolDisplayName
} from '@baishou/ui'
import { useSettingsStore } from '@baishou/store'
import { useMessageActions } from '../hooks/useMessageActions'
import styles from '../AgentScreen.module.css'

/**
 * 模糊匹配 emoji：支持 ID（含/不含扩展名）、名称、子串匹配
 * 与 persist 层的 findEmojiById 逻辑保持一致
 */
function resolvePendingEmoji(
  query: string,
  emojis: Array<{ id: string; name: string; relativePath: string }>
): { id: string; name: string; relativePath: string } | undefined {
  const normalizedQuery = query.trim().toLowerCase()

  const exactMatch = emojis.find((e) => e.id === normalizedQuery || e.id.toLowerCase() === normalizedQuery)
  if (exactMatch) return exactMatch

  const idNoExtMatch = emojis.find((e) => e.id.replace(/\.[^.]+$/, '').toLowerCase() === normalizedQuery)
  if (idNoExtMatch) return idNoExtMatch

  const normalizeName = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').trim()
  const normalizedNameQuery = normalizeName(normalizedQuery)
  const nameMatch = emojis.find((e) => normalizeName(e.name) === normalizedNameQuery)
  if (nameMatch) return nameMatch

  const idContainsMatch = emojis.find((e) =>
    e.id.replace(/\.[^.]+$/, '').toLowerCase().includes(normalizedQuery)
  )
  if (idContainsMatch) return idContainsMatch

  const nameContainsMatch = emojis.find((e) =>
    normalizeName(e.name).includes(normalizedNameQuery)
  )
  if (nameContainsMatch) return nameContainsMatch

  return undefined
}

interface AgentMessageListProps {
  t: any
  sessionId: string | undefined
  chat: any
  stream: any
  scroll: any
  currentAssistant: any
  userProfile: any
  searchMode: boolean
  model: any
  tts: any
  setContextDialogState: (state: any) => void
  sessions: any[]
  loadSessions?: (reset: boolean, assistantId?: string) => void
}

/**
 * 封装 Agent 聊天界面的消息列表及其中各气泡的所有回调事件逻辑。
 */
export const AgentMessageList: React.FC<AgentMessageListProps> = ({
  t,
  sessionId,
  chat,
  stream,
  scroll,
  currentAssistant,
  userProfile,
  searchMode,
  model,
  tts,
  setContextDialogState,
  sessions,
  loadSessions
}) => {
  const settings = useSettingsStore()

  const actions = useMessageActions({
    t,
    sessionId,
    chat,
    stream,
    model,
    tts,
    searchMode,
    currentAssistant,
    sessions,
    loadSessions
  })

  const handleShowContext = useCallback(
    async (bubbleMessage: any, sourceMsg: any) => {
      if (!sessionId) return
      try {
        const result = await window.electron.ipcRenderer.invoke(
          'agent:get-context-at-message',
          sessionId,
          sourceMsg.id,
          searchMode
        )
        const vm = result?.viewModel
        const flatEntries = (vm?.flatEntries ?? []).map((entry: any, i: number) => {
          if (entry.kind === 'round-header') {
            return { kind: 'round-header' as const, roundIndex: entry.roundIndex }
          }
          if (entry.kind === 'compression-summary') {
            return {
              kind: 'compression-summary' as const,
              summaryText: entry.summaryText ?? result?.compressedContent ?? '',
              reasoningText: entry.reasoningText ?? result?.viewModel?.compressionReasoning ?? ''
            }
          }
          if (entry.kind === 'system-prompt') {
            return {
              kind: 'system-prompt' as const,
              item: {
                id: `ctx-sys-${sourceMsg.id}`,
                sessionId,
                role: 'system',
                content: entry.item?.content ?? result?.systemPrompt,
                label: '系统提示词',
                timestamp: sourceMsg.createdAt || new Date()
              }
            }
          }
          return {
            kind: 'message' as const,
            roundIndex: entry.roundIndex,
            item: {
              id: `ctx-${sourceMsg.id}-${i}`,
              sessionId,
              role: entry.item?.role ?? 'user',
              content: entry.item?.content,
              label: entry.item?.label,
              attachments: entry.item?.attachments,
              timestamp: sourceMsg.createdAt || new Date()
            }
          }
        })

        setContextDialogState({
          isOpen: true,
          sessionId,
          sourceMessageId: sourceMsg.id,
          message: {
            ...bubbleMessage,
            inputTokens: sourceMsg.inputTokens ?? bubbleMessage.inputTokens,
            outputTokens: sourceMsg.outputTokens ?? bubbleMessage.outputTokens,
            cacheReadInputTokens:
              sourceMsg.cacheReadInputTokens ?? bubbleMessage.cacheReadInputTokens,
            cacheWriteInputTokens:
              sourceMsg.cacheWriteInputTokens ?? bubbleMessage.cacheWriteInputTokens,
            costMicros: sourceMsg.costMicros ?? bubbleMessage.costMicros
          },
          flatEntries,
          meta: {
            nextRequest: vm?.nextRequest,
            roundUsage: vm?.roundUsage,
            activeRoundIndex: vm?.activeRoundIndex
          },
          systemPrompt: result?.systemPrompt,
          compressedContent: result?.compressedContent
        })
      } catch (e) {
        console.error('[AgentMessageList] Failed to load context at message:', e)
      }
    },
    [sessionId, searchMode, setContextDialogState]
  )

  const loadMoreLockRef = useRef(false)
  const [showLoadMoreButton, setShowLoadMoreButton] = useState(false)
  const LOAD_MORE_TOP_THRESHOLD_PX = 120

  const triggerLoadMore = useCallback(() => {
    if (!chat.hasMore || loadMoreLockRef.current) return
    const el = scroll.scrollRef.current
    loadMoreLockRef.current = true
    const prevHeight = el?.scrollHeight ?? 0
    void chat.loadMore().finally(() => {
      requestAnimationFrame(() => {
        const pane = scroll.scrollRef.current
        if (pane) {
          pane.scrollTop = pane.scrollHeight - prevHeight
        }
        loadMoreLockRef.current = false
      })
    })
  }, [chat.hasMore, chat.loadMore, scroll.scrollRef])

  useEffect(() => {
    const el = scroll.scrollRef.current
    if (!el) return

    const onScroll = () => {
      const nearTop = el.scrollTop < LOAD_MORE_TOP_THRESHOLD_PX
      setShowLoadMoreButton(nearTop && chat.hasMore)
    }

    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [chat.hasMore, scroll.scrollRef])

  const compactionAnchor = chat.compactionAnchor as
    | { messageId: string; record: Record<string, unknown> }
    | null
    | undefined

  const compactionAnchorVisible = compactionAnchor
    ? chat.messages.some((msg: { id: string }) => msg.id === compactionAnchor.messageId)
    : false

  const renderPersistedCompactionBar = (
    record: {
      streamTranscript?: string
      streamReasoning?: string
      phase?: 'auto' | 'manual'
      status?: 'completed' | 'failed'
      thoughtDurationMs?: number
      summaryDurationMs?: number
    },
    phase: 'auto' | 'manual' = 'auto'
  ) => (
    <>
      <CompressionActivityBar
        phase={record.phase ?? phase}
        summary={record.streamTranscript ?? ''}
        reasoning={record.streamReasoning ?? ''}
        isActive={false}
        thoughtDurationMs={record.thoughtDurationMs}
        summaryDurationMs={record.summaryDurationMs}
      />
      {record.status !== 'failed' && <CompressionDivider />}
    </>
  )

  const activeToolDisplayName = useMemo(
    () =>
      resolveActiveToolDisplayName(stream.activeTool, t, settings.webSearchConfig?.webSearchEngine),
    [stream.activeTool, settings.webSearchConfig, t]
  )

  const pendingEmojiAttachments = useMemo(() => {
    const emojiToolConfig = normalizeEmojiToolConfig(settings.toolManagementConfig?.emojiConfig)
    const resolved = resolveAssistantEmojiConfig(
      emojiToolConfig,
      currentAssistant ? assistantRowToEmojiPrefs(currentAssistant) : undefined
    )
    const emojis = resolved.emojis
    const pending = stream.pendingEmojis ?? []
    if (!emojis?.length || !pending.length) return []

    return pending
      .map((pendingEmoji) => {
        const emoji = resolvePendingEmoji(pendingEmoji.emojiId, emojis)
        if (!emoji) return null
        return {
          id: emoji.id,
          fileName: emoji.name || emoji.id,
          filePath: resolveAttachmentImageSrc(
            `local:///${emoji.relativePath.replace(/\\/g, '/')}`
          ),
          isImage: true
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
  }, [
    stream.pendingEmojis,
    settings.toolManagementConfig?.emojiConfig,
    currentAssistant?.emojiEnabled,
    currentAssistant?.emojiGroupIds,
    currentAssistant?.emojiGroupId
  ])

  const lastMessage = chat.messages[chat.messages.length - 1]
  const assistantPersistedDuringBridge =
    stream.isBridgeActive &&
    lastMessage?.role === 'assistant' &&
    Boolean(
      lastMessage.content?.trim() ||
      lastMessage.reasoning?.trim() ||
      (lastMessage.toolInvocations?.length ?? 0) > 0 ||
      (lastMessage.attachments?.length ?? 0) > 0
    )

  return (
    <>
      <div
        className={`${styles.messageList} ${userProfile?.chatBackgroundPath ? 'chat-over-background' : ''}`}
        ref={scroll.scrollRef}
      >
        <div className={styles.messageContent}>
          {showLoadMoreButton && (
            <button
              type="button"
              className={`${styles.loadMoreBanner} ${styles.loadMoreBannerSticky}`}
              onClick={triggerLoadMore}
            >
              {t('agent.chat.load_earlier_messages', '加载更早对话')}
            </button>
          )}

          {compactionAnchor && !compactionAnchorVisible && (
            <div className={styles.compressionAnchor}>
              {renderPersistedCompactionBar(compactionAnchor.record)}
            </div>
          )}

          {[...chat.messages].map((msg) => {
            const isLiveCompressionAnchor =
              (stream.compressionPhase === 'auto' || stream.compressionPhase === 'manual') &&
              stream.compressionTriggerMessageId === msg.id &&
              stream.isCompressing

            const persistedCompaction =
              msg.role === 'user' && msg.compactionRecord
                ? msg.compactionRecord
                : compactionAnchor?.messageId === msg.id
                  ? compactionAnchor.record
                  : null

            const hasPersistedCompressionContent = Boolean(
              persistedCompaction &&
              persistedCompaction.status !== 'failed' &&
              (Boolean(persistedCompaction.streamTranscript?.trim()) ||
                Boolean(persistedCompaction.streamReasoning?.trim()))
            )

            const showCompressionDivider = hasPersistedCompressionContent

            const showLiveCompressionActivity = isLiveCompressionAnchor

            const compactionSummary = isLiveCompressionAnchor
              ? stream.compressionText
              : (persistedCompaction?.streamTranscript ?? '')

            const compactionReasoning = isLiveCompressionAnchor
              ? stream.compressionReasoning
              : (persistedCompaction?.streamReasoning ?? '')

            const compactionPhase = isLiveCompressionAnchor
              ? stream.compressionPhase
              : (persistedCompaction?.phase ?? 'auto')

            const bubbleAttachments = msg.attachments ?? mapAttachmentsFromParts(msg.parts)

            const bubbleMessage = {
              id: msg.id,
              sessionId: sessionId || 'default-session',
              role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: msg.content,
              reasoning: msg.reasoning,
              timestamp: msg.createdAt || new Date(),
              toolInvocations: msg.toolInvocations,
              attachments: bubbleAttachments,
              inputTokens: msg.inputTokens,
              outputTokens: msg.outputTokens,
              cacheReadInputTokens: msg.cacheReadInputTokens,
              cacheWriteInputTokens: msg.cacheWriteInputTokens,
              isReasoning: msg.isReasoning,
              costMicros: msg.costMicros
            }

            return (
              <React.Fragment key={msg.id}>
                <ChatBubble
                  message={bubbleMessage}
                  userProfile={{
                    nickname: userProfile?.nickname || 'User',
                    avatarPath: userProfile?.avatarPath
                  }}
                  aiProfile={{
                    name: currentAssistant?.name || 'AI',
                    avatarPath: currentAssistant?.avatarPath,
                    emoji: currentAssistant?.emoji
                  }}
                  onShowContext={
                    msg.role === 'user' || msg.role === 'assistant'
                      ? (m) => handleShowContext(m, msg)
                      : undefined
                  }
                  onReadAloud={
                    msg.role === 'assistant'
                      ? (content) => actions.handleReadAloud(content, msg.id)
                      : undefined
                  }
                  isTtsPlaying={tts.ttsPlayingMsgId === msg.id}
                  onRegenerate={
                    msg.role === 'assistant' ? () => actions.handleRegenerate(msg) : undefined
                  }
                  onEdit={() => {}}
                  onSaveEdit={(newContent) => actions.handleSaveEdit(msg, newContent)}
                  onResendEdit={(newContent) => actions.handleResendEdit(msg, newContent)}
                  onResend={msg.role === 'user' ? () => actions.handleResend(msg) : undefined}
                  onDelete={() => actions.handleDelete(msg)}
                  onBranch={msg.role === 'assistant' ? () => actions.handleBranch(msg) : undefined}
                />
                {(showLiveCompressionActivity || showCompressionDivider) && (
                  <div className={styles.compressionAnchor}>
                    {showLiveCompressionActivity ? (
                      <CompressionActivityBar
                        phase={compactionPhase}
                        summary={compactionSummary}
                        reasoning={compactionReasoning}
                        isActive
                      />
                    ) : (
                      renderPersistedCompactionBar(
                        persistedCompaction!,
                        (persistedCompaction?.phase as 'auto' | 'manual') ?? 'auto'
                      )
                    )}
                  </div>
                )}
              </React.Fragment>
            )
          })}

          {(() => {
            const showStreamingBubble =
              (stream.isStreaming || stream.isBridgeActive) &&
              !assistantPersistedDuringBridge &&
              (!stream.isCompressing ||
                Boolean(stream.text?.trim()) ||
                Boolean(stream.reasoning?.trim()) ||
                stream.activeTool ||
                stream.completedTools.length > 0 ||
                pendingEmojiAttachments.length > 0)

            return showStreamingBubble ? (
              <StreamingBubble
                text={stream.text}
                reasoning={stream.reasoning}
                isReasoning={Boolean(stream.reasoning && !stream.text)}
                isTextStreaming={stream.isStreaming}
                activeToolName={activeToolDisplayName}
                completedTools={stream.completedTools}
                attachments={pendingEmojiAttachments}
                aiProfile={{
                  name: currentAssistant?.name || 'AI',
                  avatarPath: currentAssistant?.avatarPath,
                  emoji: currentAssistant?.emoji
                }}
              />
            ) : null
          })()}

          {chat.messages.length === 0 && !stream.isStreaming && !stream.isBridgeActive && (
            <div style={{ flex: 1 }} />
          )}
        </div>
      </div>
    </>
  )
}
