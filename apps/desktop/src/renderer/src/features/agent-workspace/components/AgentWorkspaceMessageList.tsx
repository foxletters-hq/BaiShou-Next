import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import {
  AgentMarkdownRenderer,
  AgentThinkSection,
  AgentToolChainSection,
  ChatBubbleInlineEditor,
  FileChangeCard,
  MessageActionBar,
  UserMessageSkillContent,
  parseRedactedThinking,
  useChatBubbleEdit
} from '@baishou/ui'
import type { AgentStreamTimelineItem, FileChangePartData } from '@baishou/shared'
import type {
  WorkspaceChatMessage,
  PendingWorkspaceAssistantMsg
} from '../hooks/useWorkspaceChatMessages'
import type { WorkspaceToolError } from '../hooks/useWorkspaceAgentStream'
import {
  getWorkspaceAssistantText,
  getWorkspaceUserSkillRefs,
  getWorkspaceUserText
} from '../utils/workspace-message-display.util'
import {
  buildWorkspaceAssistantTimeline,
  collectWorkspaceFileChanges,
  formatWorkspaceToolDisplayName,
  isFileChangePartFailed
} from '../utils/workspace-message-parts.util'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { useChatScroll } from '../../agent/hooks/useChatScroll'
import styles from './AgentWorkspaceMessageList.module.css'

export interface AgentWorkspaceMessageListProps {
  sessionId?: string
  messages: WorkspaceChatMessage[]
  pendingAssistantMsg?: PendingWorkspaceAssistantMsg | null
  streamingText?: string
  streamingReasoning?: string
  streamingTimeline?: AgentStreamTimelineItem[]
  isStreaming?: boolean
  /** 流结束后、落库前继续展示流式片段 */
  isBridgeActive?: boolean
  streamError?: string | null
  activeToolName?: string | null
  completedTools?: Array<{ name: string; durationMs: number; error?: string }>
  failedTools?: WorkspaceToolError[]
  assistantProfile?: {
    name: string
    avatarPath?: string | null
    emoji?: string | null
  }
  onRollbackRound?: (userMessageId: string) => void
  onEditResend?: (
    userMessageId: string,
    newText: string,
    meta?: { skillRefs?: Array<{ command: string; content: string }> }
  ) => boolean | Promise<boolean>
  onChangesUpdate?: (changes: WorkspaceChangeEntry[]) => void
}

export interface AgentWorkspaceMessageListHandle {
  beginFollowIfAtBottom: () => void
  scrollToBottom: () => void
}

function copyText(text: string) {
  const value = text.trim()
  if (!value) return
  void navigator.clipboard.writeText(value).catch((error) => {
    console.error('[AgentWorkspaceMessageList] copy failed:', error)
  })
}

function BouncingDots() {
  return (
    <div className={styles.bouncingDots} aria-hidden>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  )
}

function WorkspaceUserTurn(props: {
  msg: WorkspaceChatMessage
  dimmed?: boolean
  editingActive: boolean
  onEditingChange: (messageId: string | null) => void
  onRollbackRound?: (userMessageId: string) => void
  onEditResend?: (
    userMessageId: string,
    newText: string,
    meta?: { skillRefs?: Array<{ command: string; content: string }> }
  ) => boolean | Promise<boolean>
}) {
  const { t } = useTranslation()
  const { msg, dimmed, editingActive, onEditingChange, onRollbackRound, onEditResend } = props
  const userText = getWorkspaceUserText(msg)
  const skillRefs = getWorkspaceUserSkillRefs(msg) ?? msg.skillRefs

  const edit = useChatBubbleEdit(userText, true)

  const handleResend = useCallback(async () => {
    const trimmed = edit.editedContent.trim()
    if (!trimmed || !onEditResend) return
    const applied = await onEditResend(msg.id, trimmed, { skillRefs })
    if (applied) {
      edit.handleCancelEdit()
      onEditingChange(null)
    }
  }, [edit, msg.id, onEditResend, onEditingChange, skillRefs])

  useEffect(() => {
    if (!editingActive && edit.isEditing) {
      edit.handleCancelEdit()
    }
  }, [editingActive, edit.isEditing, edit.handleCancelEdit])

  const startEdit = () => {
    edit.handleStartEdit()
    onEditingChange(msg.id)
  }

  const cancelEdit = () => {
    edit.handleCancelEdit()
    onEditingChange(null)
  }

  return (
    <div
      className={`${styles.turn} ${styles.userTurn}${dimmed ? ` ${styles.turnDimmed}` : ''}`}
    >
      {edit.isEditing ? (
        <div className={styles.userEditWrap}>
          <ChatBubbleInlineEditor
            isUser
            editedContent={edit.editedContent}
            onChange={edit.setEditedContent}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelEdit()
                return
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void handleResend()
              }
            }}
            onCancel={cancelEdit}
            onSave={cancelEdit}
            onResend={() => {
              void handleResend()
            }}
            textareaRef={edit.textareaRef}
          />
        </div>
      ) : (
        <>
          <div className={styles.userAnchor}>
            {userText || skillRefs?.length ? (
              <UserMessageSkillContent text={userText} skillRefs={skillRefs} />
            ) : null}
          </div>
          <div className={styles.turnActions}>
            <MessageActionBar
              isAI={false}
              onCopy={() => copyText(userText)}
              onEdit={onEditResend ? startEdit : undefined}
            />
            {onRollbackRound ? (
              <button
                type="button"
                className={styles.rollbackBtn}
                onClick={() => onRollbackRound(msg.id)}
              >
                {t('round_rollback.action', '回滚本轮')}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function renderStreamTimelineItem(
  item: AgentStreamTimelineItem,
  index: number,
  options: {
    isStreaming: boolean
    isLast: boolean
    failedByName: Map<string, string>
  }
) {
  if (item.kind === 'reasoning') {
    const parsed = parseRedactedThinking('', item.text)
    const content = parsed.cleanReasoning || item.text
    if (!content.trim()) return null
    return (
      <AgentThinkSection
        key={`stream-reasoning-${index}`}
        content={content}
        isStreaming={options.isStreaming && options.isLast}
      />
    )
  }
  if (item.kind === 'text') {
    const parsed = parseRedactedThinking(item.text, '')
    const content = parsed.cleanContent || item.text
    if (!content.trim()) return null
    return (
      <AgentMarkdownRenderer
        key={`stream-text-${index}`}
        content={content}
        isStreaming={options.isStreaming && options.isLast}
      />
    )
  }

  const displayName = formatWorkspaceToolDisplayName(item.name)
  const failedError = options.failedByName.get(item.name)
  if (item.status === 'running') {
    return (
      <AgentToolChainSection
        key={`stream-tool-${item.callId || index}`}
        activeToolName={displayName}
        isStreaming
      />
    )
  }
  return (
    <AgentToolChainSection
      key={`stream-tool-${item.callId || index}`}
      completedTools={[
        {
          name: displayName,
          durationMs: item.durationMs ?? 0,
          error: failedError
        }
      ]}
    />
  )
}

export const AgentWorkspaceMessageList = forwardRef<
  AgentWorkspaceMessageListHandle,
  AgentWorkspaceMessageListProps
>(function AgentWorkspaceMessageList(
  {
    sessionId,
    messages,
    pendingAssistantMsg,
    streamingText = '',
    streamingReasoning = '',
    streamingTimeline = [],
    isStreaming = false,
    isBridgeActive = false,
    streamError = null,
    activeToolName = null,
    completedTools = [],
    failedTools = [],
    onRollbackRound,
    onEditResend,
    onChangesUpdate
  },
  ref
) {
  const { t } = useTranslation()
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const activeTool = useMemo(
    () => (activeToolName ? { name: activeToolName, args: null } : null),
    [activeToolName]
  )
  const streamFollowKey = useMemo(
    () =>
      `${streamingTimeline.length}:${streamingTimeline.map((item) => item.kind).join(',')}:${isBridgeActive ? 1 : 0}`,
    [streamingTimeline, isBridgeActive]
  )
  const scroll = useChatScroll({
    sessionId,
    messages,
    streamingText,
    streamingReasoning,
    isStreaming: isStreaming || isBridgeActive,
    activeTool,
    streamFollowKey
  })

  useImperativeHandle(
    ref,
    () => ({
      beginFollowIfAtBottom: scroll.beginFollowIfAtBottom,
      scrollToBottom: scroll.scrollToBottom
    }),
    [scroll.beginFollowIfAtBottom, scroll.scrollToBottom]
  )

  const syncChanges = useCallback(
    (list: WorkspaceChatMessage[]) => {
      onChangesUpdate?.(collectWorkspaceFileChanges(list))
    },
    [onChangesUpdate]
  )

  useEffect(() => {
    syncChanges(messages)
  }, [messages, syncChanges])

  useEffect(() => {
    setEditingMessageId(null)
  }, [sessionId])

  const editingIndex = useMemo(() => {
    if (!editingMessageId) return -1
    return messages.findIndex((msg) => msg.id === editingMessageId)
  }, [editingMessageId, messages])

  const failedByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const tool of failedTools) {
      map.set(tool.name, tool.error)
    }
    for (const tool of completedTools) {
      if (tool.error) map.set(tool.name, tool.error)
    }
    return map
  }, [completedTools, failedTools])

  const lastMessage = messages[messages.length - 1]
  const assistantPersistedDuringBridge =
    isBridgeActive &&
    lastMessage?.role === 'assistant' &&
    Boolean(
      lastMessage.content?.trim() ||
        lastMessage.reasoning?.trim() ||
        (lastMessage.parts?.length ?? 0) > 0
    )
  const showStreamingBubble =
    (isStreaming || isBridgeActive) && !assistantPersistedDuringBridge
  const showPendingAssistant =
    !isStreaming &&
    !isBridgeActive &&
    Boolean(pendingAssistantMsg) &&
    !(
      lastMessage?.role === 'assistant' &&
      Boolean(
        lastMessage.content?.trim() ||
          lastMessage.reasoning?.trim() ||
          (lastMessage.parts?.length ?? 0) > 0
      )
    )

  const useLiveTimeline = streamingTimeline.length > 0
  const streamingParsed = useMemo(
    () => parseRedactedThinking(streamingText, streamingReasoning),
    [streamingText, streamingReasoning]
  )

  const streamingCompletedTools = useMemo(
    () => [
      ...completedTools.map((tool) => ({
        name: formatWorkspaceToolDisplayName(tool.name),
        durationMs: tool.durationMs,
        error: tool.error
      })),
      ...failedTools.map((tool) => ({
        name: formatWorkspaceToolDisplayName(tool.name),
        durationMs: 0,
        error: tool.error
      }))
    ],
    [completedTools, failedTools]
  )

  const activeToolDisplayName = activeToolName
    ? formatWorkspaceToolDisplayName(activeToolName)
    : null

  if (!sessionId || sessionId === 'new-session') {
    return (
      <div className={styles.scrollWrap}>
        <div className={styles.scroll} ref={scroll.scrollRef}>
          <div className={styles.list} />
        </div>
      </div>
    )
  }

  const streamHasTimelineContent = useLiveTimeline
    ? streamingTimeline.some((item) => {
        if (item.kind === 'tool') return true
        return Boolean(item.text.trim())
      })
    : false
  const streamHasTools =
    streamingCompletedTools.some((tool) => !tool.error) || Boolean(activeToolDisplayName)
  const streamHasReasoning =
    streamingParsed.cleanReasoning.length > 0 ||
    Boolean(streamingReasoning && !streamingParsed.cleanContent)
  const streamHasText = streamingParsed.cleanContent.length > 0
  const lastTimelineItem = useLiveTimeline
    ? streamingTimeline[streamingTimeline.length - 1]
    : undefined
  const lastItemIsLiveText =
    isStreaming &&
    !isBridgeActive &&
    ((lastTimelineItem?.kind === 'text' && Boolean(lastTimelineItem.text.trim())) ||
      (lastTimelineItem?.kind === 'reasoning' && Boolean(lastTimelineItem.text.trim())) ||
      (!useLiveTimeline && (streamHasText || Boolean(streamingReasoning))))
  // 工具/确认门禁之后模型尚未吐字时，仍显示等待点，避免「卡住了」的空窗
  const streamShowWaiting =
    isStreaming &&
    !isBridgeActive &&
    !streamError &&
    !lastItemIsLiveText
  const streamShowPlaceholder =
    streamShowWaiting &&
    !(useLiveTimeline
      ? streamHasTimelineContent
      : streamHasText || streamHasTools || streamHasReasoning)

  const isEditingTurn = Boolean(editingMessageId)

  return (
    <div className={styles.scrollWrap}>
      <div className={styles.scroll} ref={scroll.scrollRef}>
        <div className={styles.list}>
          {messages.length === 0 && !showStreamingBubble && !showPendingAssistant ? (
            <p className={styles.empty}>
              {t(
                'round_rollback.help_scope',
                '会话回滚仅覆盖 AI 写工具已知路径；重要节点请用版本控制保存。'
              )}
            </p>
          ) : null}
          {messages.map((msg, index) => {
          if (msg.role === 'user') {
            return (
              <WorkspaceUserTurn
                key={msg.id}
                msg={msg}
                dimmed={editingIndex >= 0 && index > editingIndex}
                editingActive={editingMessageId === msg.id}
                onEditingChange={setEditingMessageId}
                onRollbackRound={onRollbackRound}
                onEditResend={onEditResend}
              />
            )
          }

          const timeline = buildWorkspaceAssistantTimeline(msg.parts)
          const assistantText =
            timeline
              .filter((item) => item.kind === 'text')
              .map((item) => (item.kind === 'text' ? item.text : ''))
              .join('\n')
              .trim() || getWorkspaceAssistantText(msg)

          return (
            <div
              key={msg.id}
              className={`chat-bubble-container ${styles.turn} ${styles.assistantTurn}${
                editingIndex >= 0 && index > editingIndex ? ` ${styles.turnDimmed}` : ''
              }`}
            >
              {timeline.length > 0
                ? timeline.map((item) => {
                    if (item.kind === 'reasoning') {
                      return <AgentThinkSection key={item.key} content={item.text} />
                    }
                    if (item.kind === 'text') {
                      return <AgentMarkdownRenderer key={item.key} content={item.text} />
                    }
                    if (item.kind === 'tool') {
                      return (
                        <AgentToolChainSection
                          key={item.key}
                          invocations={[item.invocation]}
                        />
                      )
                    }
                    if (isFileChangePartFailed(item.data)) {
                      return (
                        <div key={item.key} className={styles.fileChangeError}>
                          {t('file_change.failed', '文件变更失败')}: {item.data.path}
                        </div>
                      )
                    }
                    return <FileChangeCard key={item.key} data={item.data as FileChangePartData} />
                  })
                : null}
              {assistantText ? (
                <div className={styles.turnActions}>
                  <MessageActionBar isAI onCopy={() => copyText(assistantText)} />
                </div>
              ) : null}
            </div>
          )
        })}

        {showStreamingBubble ? (
          <div
            className={`chat-bubble-container ${styles.turn} ${styles.assistantTurn}${
              isEditingTurn ? ` ${styles.turnDimmed}` : ''
            }`}
          >
            {streamError ? (
              <div className={styles.streamError} role="alert">
                {streamError}
              </div>
            ) : null}
            {useLiveTimeline
              ? streamingTimeline.map((item, index) =>
                  renderStreamTimelineItem(item, index, {
                    isStreaming: isStreaming && !isBridgeActive,
                    isLast: index === streamingTimeline.length - 1,
                    failedByName
                  })
                )
              : (
                  <>
                    {streamHasReasoning ? (
                      <AgentThinkSection
                        content={streamingParsed.cleanReasoning}
                        isStreaming={Boolean(streamingReasoning && !streamingParsed.cleanContent)}
                      />
                    ) : null}
                    {streamHasTools ? (
                      <AgentToolChainSection
                        completedTools={streamingCompletedTools.filter((tool) => !tool.error)}
                        activeToolName={activeToolDisplayName}
                        isStreaming
                      />
                    ) : null}
                    {streamHasText ? (
                      <AgentMarkdownRenderer
                        content={streamingParsed.cleanContent}
                        isStreaming={isStreaming && !isBridgeActive}
                      />
                    ) : null}
                  </>
                )}
            {streamShowPlaceholder || streamShowWaiting ? <BouncingDots /> : null}
            {failedTools.length > 0 || streamingCompletedTools.some((tool) => tool.error) ? (
              <ul className={styles.streamToolErrors}>
                {[
                  ...failedTools.map((tool) => ({
                    name: formatWorkspaceToolDisplayName(tool.name),
                    error: tool.error
                  })),
                  ...streamingCompletedTools
                    .filter((tool) => tool.error)
                    .map((tool) => ({ name: tool.name, error: tool.error! }))
                ].map((tool, index) => (
                  <li key={`${tool.name}-stream-err-${index}`}>
                    {tool.name}: {tool.error}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {showPendingAssistant && pendingAssistantMsg ? (
          <div
            className={`chat-bubble-container ${styles.turn} ${styles.assistantTurn}${
              isEditingTurn ? ` ${styles.turnDimmed}` : ''
            }`}
          >
            {pendingAssistantMsg.reasoning ? (
              <AgentThinkSection content={pendingAssistantMsg.reasoning} />
            ) : null}
            {pendingAssistantMsg.content ? (
              <AgentMarkdownRenderer content={pendingAssistantMsg.content} />
            ) : null}
            {pendingAssistantMsg.content ? (
              <div className={styles.turnActions}>
                <MessageActionBar
                  isAI
                  onCopy={() => copyText(pendingAssistantMsg.content)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>
      {scroll.showScrollButton ? (
        <button
          type="button"
          className={styles.scrollBottomBtn}
          onClick={scroll.scrollToBottom}
          title={t('workbench.scroll_to_bottom', '回到底部')}
          aria-label={t('workbench.scroll_to_bottom', '回到底部')}
        >
          <ChevronDown size={18} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  )
})
