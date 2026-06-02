import React, { useMemo, useCallback, useEffect, useRef } from 'react'
import { ChatBubble, StreamingBubble } from '@baishou/ui'
import { useSettingsStore } from '@baishou/store'
import { useMessageActions } from '../hooks/useMessageActions'
import styles from '../AgentScreen.module.css'

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
              summaryText: entry.summaryText ?? result?.compressedContent ?? ''
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
      if (el.scrollTop > 100 || !chat.hasMore || loadMoreLockRef.current) return
      triggerLoadMore()
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [chat.hasMore, triggerLoadMore, scroll.scrollRef])

  const activeToolDisplayName = useMemo(() => {
    if (!stream.activeTool) return null
    if (stream.activeTool.name === 'web_search') {
      const engine = settings.webSearchConfig?.webSearchEngine || 'duckduckgo'
      const engineNames: Record<string, string> = {
        'local-google': t('settings.web_search_engine_local_google', 'Google 本地搜索'),
        'local-bing': t('settings.web_search_engine_local_bing', 'Bing 本地搜索'),
        duckduckgo: t('settings.web_search_engine_duckduckgo', 'DuckDuckGo'),
        tavily: t('settings.web_search_engine_tavily', 'Tavily API')
      }
      return `${t('agent.tools.web_search', '网络搜索')} (${engineNames[engine] || engine})`
    }
    return t(`agent.tools.${stream.activeTool.name}`, stream.activeTool.name)
  }, [stream.activeTool, settings.webSearchConfig, t])

  return (
    <>
      <div className={styles.messageList} ref={scroll.scrollRef}>
        <div className={styles.messageContent}>
          {chat.hasMore && (
            <button
              type="button"
              className={styles.loadMoreBanner}
              onClick={triggerLoadMore}
            >
              {t('agent.chat.scroll_up_load_more', '点击或上滑加载更早对话')}
            </button>
          )}

          {[...chat.messages].map((msg) => {
            const bubbleMessage = {
              id: msg.id,
              sessionId: sessionId || 'default-session',
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              reasoning: msg.reasoning,
              timestamp: msg.createdAt || new Date(),
              toolInvocations: msg.toolInvocations,
              attachments: msg.attachments,
              inputTokens: msg.inputTokens,
              outputTokens: msg.outputTokens,
              isReasoning: msg.isReasoning,
              costMicros: msg.costMicros
            }

            return (
              <ChatBubble
                key={msg.id}
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
            )
          })}

          {stream.isStreaming && (
            <StreamingBubble
              text={stream.text}
              reasoning={stream.reasoning}
              isReasoning={Boolean(stream.reasoning && !stream.text)}
              activeToolName={activeToolDisplayName}
              completedTools={stream.completedTools}
              aiProfile={{
                name: currentAssistant?.name || 'AI',
                avatarPath: currentAssistant?.avatarPath,
                emoji: currentAssistant?.emoji
              }}
            />
          )}

          {chat.pendingAssistantMsg && (
            <ChatBubble
              key={chat.pendingAssistantMsg.id}
              message={{
                id: chat.pendingAssistantMsg.id,
                sessionId: sessionId || 'default-session',
                role: 'assistant',
                content: chat.pendingAssistantMsg.content,
                reasoning: chat.pendingAssistantMsg.reasoning,
                timestamp: new Date(),
                isReasoning: Boolean(
                  chat.pendingAssistantMsg.reasoning && !chat.pendingAssistantMsg.content
                )
              }}
              aiProfile={{
                name: currentAssistant?.name || 'AI',
                avatarPath: currentAssistant?.avatarPath,
                emoji: currentAssistant?.emoji
              }}
            />
          )}

          {chat.messages.length === 0 && !stream.isStreaming && !chat.pendingAssistantMsg && (
            <div style={{ flex: 1 }} />
          )}
        </div>
      </div>
    </>
  )
}
