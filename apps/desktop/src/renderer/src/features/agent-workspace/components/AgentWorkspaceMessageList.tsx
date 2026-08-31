import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import {
  AgentMarkdownRenderer,
  AgentThinkSection,
  AgentToolChainSection,
  ChatBubbleAttachments,
  MessageActionBar,
  UserMessageSkillContent,
  parseRedactedThinking
} from '@baishou/ui'
import type { AgentStreamTimelineItem, MockToolInvocation, WorkspaceChangeEntry } from '@baishou/shared'
import type {
  WorkspaceChatMessage,
  PendingWorkspaceAssistantMsg
} from '../hooks/useWorkspaceChatMessages'
import type { WorkspaceToolError } from '../hooks/useWorkspaceAgentStream'
import {
  getWorkspaceAssistantText,
  getWorkspaceUserAttachments,
  getWorkspaceUserSkillRefs,
  getWorkspaceUserText
} from '../utils/workspace-message-display.util'
import {
  buildFileOpEntries,
  buildWorkspaceAssistantTimeline,
  formatWorkspaceToolDisplayName,
  groupStreamTimelineItems,
  groupWorkspaceAssistantTimeline,
  type WorkspaceStreamTimelineGroup
} from '../utils/workspace-message-parts.util'
import { shouldStartWorkspaceBubbleEdit } from '../utils/workspace-rollback-hover.util'
import {
  shouldShowStreamWaitingDots,
  streamTimelineHasRunningTool
} from '../utils/workspace-stream-waiting.util'
import { useChatScroll } from '../../agent/hooks/useChatScroll'
import { WorkspaceFileChangeList } from './WorkspaceFileChangeList'
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
  onEditResend?: (
    userMessageId: string,
    newText: string,
    meta?: { skillRefs?: Array<{ command: string; content: string }> }
  ) => boolean | Promise<boolean>
  onSelectChange?: (change: WorkspaceChangeEntry) => void
  onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
  hasMore?: boolean
  onLoadMore?: () => Promise<void>
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
  onEditResend?: (
    userMessageId: string,
    newText: string,
    meta?: { skillRefs?: Array<{ command: string; content: string }> }
  ) => boolean | Promise<boolean>
}) {
  const { t } = useTranslation()
  const {
    msg,
    dimmed,
    editingActive,
    onEditingChange,
    onEditResend
  } = props
  const userText = getWorkspaceUserText(msg)
  const skillRefs = getWorkspaceUserSkillRefs(msg) ?? msg.skillRefs
  const attachments = getWorkspaceUserAttachments(msg)
  const [editedContent, setEditedContent] = useState(userText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingActive) {
      setEditedContent(userText)
    }
  }, [editingActive, userText])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!editingActive || !textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 40)}px`
  }, [editingActive, editedContent])

  useEffect(() => {
    if (!editingActive || !textareaRef.current) return
    const textarea = textareaRef.current
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [editingActive])

  const startEdit = () => {
    if (!onEditResend) return
    onEditingChange(msg.id)
  }

  const cancelEdit = () => {
    setEditedContent(userText)
    onEditingChange(null)
  }

  const handleResend = useCallback(async () => {
    const trimmed = editedContent.trim()
    if (!trimmed || !onEditResend) return
    const applied = await onEditResend(msg.id, trimmed, { skillRefs })
    if (applied) {
      onEditingChange(null)
    }
  }, [editedContent, msg.id, onEditResend, onEditingChange, skillRefs])

  const handleBubbleClick = (event: React.MouseEvent) => {
    if (!onEditResend || editingActive) return
    const selection = window.getSelection()
    if (
      !shouldStartWorkspaceBubbleEdit({
        defaultPrevented: event.defaultPrevented,
        target: event.target,
        hasNonCollapsedSelection: Boolean(
          selection && !selection.isCollapsed && selection.toString().trim()
        )
      })
    ) {
      return
    }
    startEdit()
  }

  return (
    <div
      className={`chat-bubble-container ${styles.turn} ${styles.userTurn}${
        dimmed ? ` ${styles.turnDimmed}` : ''
      }${editingActive ? ` ${styles.turnEditing}` : ''}`}
    >
      {editingActive ? (
        <div className={styles.userEditWrap}>
          <textarea
            ref={textareaRef}
            className={styles.userEditArea}
            value={editedContent}
            onChange={(event) => setEditedContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelEdit()
                return
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                void handleResend()
              }
            }}
            rows={1}
            aria-label={t('workbench.click_to_edit_message', '点击编辑这条消息')}
          />
          <div className={styles.userEditActions}>
            <button type="button" className={styles.userEditCancel} onClick={cancelEdit}>
              {t('common.cancel', '取消')}
            </button>
            <button
              type="button"
              className={styles.userEditSend}
              onClick={() => {
                void handleResend()
              }}
            >
              {t('workbench.send_edited_message', '发送')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`${styles.userAnchor}${onEditResend ? ` ${styles.userAnchorEditable}` : ''}`}
            title={onEditResend ? t('workbench.click_to_edit_message', '点击编辑这条消息') : undefined}
            onClick={handleBubbleClick}
          >
            {attachments.length > 0 ? (
              <ChatBubbleAttachments attachments={attachments} />
            ) : null}
            {userText || skillRefs?.length ? (
              <UserMessageSkillContent text={userText} skillRefs={skillRefs} />
            ) : null}
          </div>
          <div className={styles.turnActions}>
            <MessageActionBar isAI={false} onCopy={() => copyText(userText)} />
          </div>
        </>
      )}
    </div>
  )
}

function streamToolToInvocation(
  item: Extract<AgentStreamTimelineItem, { kind: 'tool' }>
): MockToolInvocation {
  return {
    toolCallId: item.callId,
    toolName: item.name,
    state: item.status === 'completed' ? 'result' : 'call',
    args: item.arguments ?? {},
    result: item.result
  }
}

function renderStreamFileOps(
  items: Array<Extract<AgentStreamTimelineItem, { kind: 'tool' }>>,
  options: {
    onSelectChange?: (change: WorkspaceChangeEntry) => void
    onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
  }
) {
  const changes = buildFileOpEntries('stream', items.map(streamToolToInvocation), [])
  if (changes.length === 0) return null
  return (
    <WorkspaceFileChangeList
      key={`stream-files-${items[0]?.callId ?? items[0]?.name}`}
      changes={changes}
      running={items.some((item) => item.status === 'running')}
      onSelectChange={options.onSelectChange ?? (() => undefined)}
    />
  )
}

function renderStreamToolGroup(
  items: Array<Extract<AgentStreamTimelineItem, { kind: 'tool' }>>,
  failedByName: Map<string, string>
) {
  const completed = items.filter((item) => item.status !== 'running')
  const running = items.find((item) => item.status === 'running')
  return (
    <AgentToolChainSection
      key={`stream-tools-${items[0]?.callId ?? items[0]?.name}`}
      completedTools={completed.map((item) => ({
        name: item.name,
        durationMs: item.durationMs ?? 0,
        toolCallId: item.callId,
        result: item.result,
        args: item.arguments,
        error: item.status === 'failed' ? failedByName.get(item.name) : undefined
      }))}
      activeToolName={running?.name ?? null}
      activeToolArgs={running?.arguments}
      isStreaming={Boolean(running)}
    />
  )
}

function renderStreamTimelineItem(
  item: WorkspaceStreamTimelineGroup,
  index: number,
  options: {
    isStreaming: boolean
    isLast: boolean
    failedByName: Map<string, string>
    onSelectChange?: (change: WorkspaceChangeEntry) => void
    onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
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

  if (item.kind === 'file_ops') {
    return renderStreamFileOps(item.items, options)
  }

  return renderStreamToolGroup(item.items, options.failedByName)
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
    onEditResend,
    onSelectChange,
    onReviewAll,
    hasMore = false,
    onLoadMore
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

  useEffect(() => {
    setEditingMessageId(null)
  }, [sessionId])

  const loadMoreLockRef = useRef(false)
  const [showLoadMoreButton, setShowLoadMoreButton] = useState(false)
  const LOAD_MORE_TOP_THRESHOLD_PX = 120

  const syncLoadMoreVisibility = useCallback(() => {
    const el = scroll.scrollRef.current
    if (!el || !hasMore) {
      setShowLoadMoreButton(false)
      return
    }
    setShowLoadMoreButton(el.scrollTop < LOAD_MORE_TOP_THRESHOLD_PX)
  }, [hasMore, scroll.scrollRef])

  const triggerLoadMore = useCallback(() => {
    if (!hasMore || !onLoadMore || loadMoreLockRef.current) return
    const el = scroll.scrollRef.current
    loadMoreLockRef.current = true
    const prevHeight = el?.scrollHeight ?? 0
    void onLoadMore().finally(() => {
      requestAnimationFrame(() => {
        const pane = scroll.scrollRef.current
        if (pane) {
          pane.scrollTop = pane.scrollHeight - prevHeight
        }
        loadMoreLockRef.current = false
        syncLoadMoreVisibility()
      })
    })
  }, [hasMore, onLoadMore, scroll.scrollRef, syncLoadMoreVisibility])

  useEffect(() => {
    const el = scroll.scrollRef.current
    if (!el) return
    syncLoadMoreVisibility()
    el.addEventListener('scroll', syncLoadMoreVisibility, { passive: true })
    return () => el.removeEventListener('scroll', syncLoadMoreVisibility)
  }, [syncLoadMoreVisibility, messages.length, sessionId, scroll.scrollRef])

  useLayoutEffect(() => {
    syncLoadMoreVisibility()
  }, [syncLoadMoreVisibility, messages.length, isStreaming, isBridgeActive])

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
        name: tool.name,
        durationMs: tool.durationMs,
        error: tool.error
      })),
      ...failedTools.map((tool) => ({
        name: tool.name,
        durationMs: 0,
        error: tool.error
      }))
    ],
    [completedTools, failedTools]
  )

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
    streamingCompletedTools.some((tool) => !tool.error) || Boolean(activeToolName)
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
  // 工具/确认门禁之后模型尚未吐字时，仍显示等待点，避免「卡住了」的空窗。
  // 工具行已有转动指示时不再叠底部三点。
  const streamShowWaiting = shouldShowStreamWaitingDots({
    isStreaming,
    isBridgeActive,
    streamError,
    lastItemIsLiveText,
    hasRunningTool: streamTimelineHasRunningTool(streamingTimeline, activeToolName)
  })
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
          {showLoadMoreButton ? (
            <button type="button" className={styles.loadMoreBanner} onClick={triggerLoadMore}>
              {t('agent.chat.load_earlier_messages', '加载更早对话')}
            </button>
          ) : null}
          {messages.length === 0 && !showStreamingBubble && !showPendingAssistant ? (
            <p className={styles.empty}>
              {t('workbench.chat_empty', '在下方输入，开始这一轮协作')}
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
                onEditResend={onEditResend}
              />
            )
          }

          const timeline = buildWorkspaceAssistantTimeline(msg.parts)
          const timelineGroups = groupWorkspaceAssistantTimeline(timeline)
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
              {timelineGroups.length > 0
                ? timelineGroups.map((item) => {
                    if (item.kind === 'reasoning') {
                      return <AgentThinkSection key={item.key} content={item.text} />
                    }
                    if (item.kind === 'text') {
                      return <AgentMarkdownRenderer key={item.key} content={item.text} />
                    }
                    if (item.kind === 'tools') {
                      return (
                        <AgentToolChainSection
                          key={item.key}
                          invocations={item.invocations}
                        />
                      )
                    }
                    if (item.kind === 'file_change_failed') {
                      return (
                        <div key={item.key} className={styles.fileChangeError}>
                          {t('file_change.failed', '文件变更失败')}: {item.data.path}
                        </div>
                      )
                    }
                    return (
                      <WorkspaceFileChangeList
                        key={item.key}
                        changes={buildFileOpEntries(
                          msg.id,
                          item.invocations,
                          item.items.map((entry) => entry.data)
                        )}
                        onSelectChange={(change) => onSelectChange?.(change)}
                      />
                    )
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
              ? groupStreamTimelineItems(streamingTimeline).map((item, index, groups) =>
                  renderStreamTimelineItem(item, index, {
                    isStreaming: isStreaming && !isBridgeActive,
                    isLast: index === groups.length - 1,
                    failedByName,
                    onSelectChange,
                    onReviewAll
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
                        activeToolName={activeToolName}
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
