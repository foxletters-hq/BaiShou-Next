import React, { useMemo } from 'react'
import { ChatBubble, StreamingBubble } from '@baishou/ui'
import { useSettingsStore } from '@baishou/store'
import { useMessageActions } from '../hooks/useMessageActions'
import styles from '../AgentScreen.module.css'

interface AgentMessageListProps {
  t: any
  sessionId: string | undefined
  chat: any // ReturnType<typeof useChatMessages>
  stream: any // ReturnType<typeof useAgentStream>
  scroll: any // ReturnType<typeof useChatScroll>
  currentAssistant: any
  userProfile: any
  searchMode: boolean
  model: any // ReturnType<typeof useModelSelection>
  tts: any // ReturnType<typeof useTts>
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

  // 气泡动作 hook
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

  // ── 解析当前正在运行的工具名称（汉化及搜索引擎展示） ──
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
      {/* 消息列表 */}
      <div className={styles.messageList} ref={scroll.scrollRef}>
        <div className={styles.messageContent}>
          {/* 分页加载 */}
          {chat.hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <button
                onClick={chat.loadMore}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: 0.8,
                  textDecoration: 'underline'
                }}
              >
                {t('common.load_more', '点击加载更多记录')}
              </button>
            </div>
          )}

          {/* 历史消息 */}
          {[...chat.messages].map((msg, index, arr) => {
            let decodedContext: any[] | undefined
            let compressedContent: string | undefined
            let originalContent: string | undefined
            let systemPrompt: string | undefined

            if (msg.role === 'assistant' && index > 0) {
              const prevMsg = arr[index - 1]
              if (prevMsg.role === 'user' && prevMsg.parts) {
                const ctxPart = prevMsg.parts.find((p: any) => p.type === 'context_snapshot')
                if (ctxPart && ctxPart.data?.snapshots) {
                  decodedContext = ctxPart.data.snapshots.map((s: any) => ({
                    role: 'system',
                    content: `${s.title ? '[' + s.title + '] ' : ''}${s.content}`,
                    timestamp: msg.createdAt || new Date()
                  }))
                }

                // 获取压缩内容
                const compPart = prevMsg.parts.find((p: any) => p.type === 'compaction')
                if (compPart && compPart.data?.summary) {
                  compressedContent = compPart.data.summary
                }
              }

              // 获取系统提示词（从会话的第一条消息或助手配置）
              if (index === 1 || (index === 2 && arr[0]?.role === 'system')) {
                const sysMsg = arr.find((m: any) => m.role === 'system')
                if (sysMsg?.content) {
                  systemPrompt = sysMsg.content
                }
              }
            }

            return (
              <ChatBubble
                key={msg.id}
                message={{
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
                  costMicros: msg.costMicros,
                  contextMessages: decodedContext
                }}
                userProfile={{
                  nickname: userProfile?.nickname || 'User',
                  avatarPath: userProfile?.avatarPath
                }}
                aiProfile={{
                  name: currentAssistant?.name || 'AI',
                  avatarPath: currentAssistant?.avatarPath,
                  emoji: currentAssistant?.emoji
                }}
                onShowContext={(m) => {
                  setContextDialogState({
                    isOpen: true,
                    message: m,
                    contextMessages: m.contextMessages || [],
                    compressedContent,
                    originalContent: m.content,
                    systemPrompt
                  })
                }}
                onReadAloud={
                  msg.role === 'assistant'
                    ? (content) => actions.handleReadAloud(content, msg.id)
                    : undefined
                }
                isTtsPlaying={tts.ttsPlayingMsgId === msg.id}
                onRegenerate={
                  msg.role === 'assistant'
                    ? () => actions.handleRegenerate(msg)
                    : undefined
                }
                onEdit={() => {}}
                onSaveEdit={(newContent) => actions.handleSaveEdit(msg, newContent)}
                onResendEdit={(newContent) => actions.handleResendEdit(msg, newContent)}
                onResend={
                  msg.role === 'user'
                    ? () => actions.handleResend(msg)
                    : undefined
                }
                onDelete={() => actions.handleDelete(msg)}
                onBranch={
                  msg.role === 'assistant'
                    ? () => actions.handleBranch(msg)
                    : undefined
                }
              />
            )
          })}

          {/* 流式气泡 */}
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

          {/* 流式结束过渡态 */}
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

          {/* 空状态：仅在既无消息也无流式传输时显示空白区域 */}
          {chat.messages.length === 0 && !stream.isStreaming && !chat.pendingAssistantMsg && (
            <div style={{ flex: 1 }} />
          )}
        </div>
      </div>
    </>
  )
}
