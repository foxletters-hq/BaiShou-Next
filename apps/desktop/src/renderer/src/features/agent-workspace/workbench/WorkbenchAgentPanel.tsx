import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cloud, ChevronDown, MessagesSquare, Plus, Sparkles } from 'lucide-react'
import type {
  AgentGateRequest,
  AgentWorkspaceEntry,
  AgentWorkspaceSessionListItem,
  PromptFileRef,
  WorkspaceChangeEntry
} from '@baishou/shared'
import {
  exclusiveInputTokens,
  formatDialogueModelLabel,
  getModelContextWindow,
  isConfiguredProviderId,
  pickLastRoundUsage,
  skillToPromptShortcut
} from '@baishou/shared'
import {
  ContextUsageRing,
  InputBar,
  ShortcutManagerDialog,
  getProviderIcon,
  resolveDesktopAssistantAvatarSrc,
  useTheme,
  type AgentGateReplyPayload,
  type InputBarRef,
  type PromptShortcut
} from '@baishou/ui'
import { usePromptShortcutStore } from '@baishou/store'
import { usePersistedSearchMode } from '../../agent/hooks/usePersistedSearchMode'
import chromeStyles from '../../agent/components/AgentChatChrome.module.css'
import { AgentWorkspaceMessageList, type AgentWorkspaceMessageListHandle } from '../components/AgentWorkspaceMessageList'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'
import { useWorkbenchInputPlaceholder } from '../utils/workbench-input-placeholder'
import { createWorkspaceComposerDropResolver } from '../utils/workspace-composer-drop.util'
import { searchWorkspaceFileNames } from '../utils/workspace-file-mention-search.util'
import { WorkbenchSessionView } from './WorkbenchSessionView'
import { KnowledgeMountHint } from '../../knowledge/KnowledgeMountHint'
import { WorkbenchNotebookMountDialog } from './WorkbenchNotebookMountDialog'
import styles from './WorkbenchAgentPanel.module.css'

export interface WorkbenchAgentPanelProps {
  width: number
  workspace: AgentWorkspaceEntry | null
  hasWorkspace: boolean
  hasConfiguredModel: boolean
  sessionId?: string
  sessions: AgentWorkspaceSessionListItem[]
  loadingSessions?: boolean
  onSelectChange: (change: WorkspaceChangeEntry) => void
  onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
  sessionsViewActive?: boolean
  onToggleSessionsView?: () => void
  onNewSession: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession?: (sessionId: string, title: string) => void
  recentFilePaths?: string[]
  onOpenFile?: (relativePath: string, options?: { line?: number }) => void
  chrome: {
    currentAssistant?: { id: string; name: string; avatarPath?: string | null }
    currentProviderId: string
    currentModelId: string
    providers: Array<{
      id: string
      name?: string
      type?: string
      models?: string[]
      enabledModels?: string[]
    }>
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadInputTokens: number
    totalCacheWriteInputTokens: number
    estimatedCost: number
    onAssistantClick: () => void
    onModelClick: (anchorRect?: DOMRect | null) => void
    effortSuffix?: string | null
    pricingLastUpdated?: Date | null
    onRefreshPricing?: () => Promise<{ success: boolean; error?: string }>
  }
  chat: {
    messages: unknown[]
    pendingAssistantMsg: unknown
    hasMore?: boolean
    loadMore?: () => Promise<void>
  }
  stream: {
    text: string
    reasoning: string
    timeline?: import('@baishou/shared').AgentStreamTimelineItem[]
    isStreaming: boolean
    isBridgeActive?: boolean
    error: string | null
    activeToolName: string | null
    completedTools: unknown[]
    failedTools: unknown[]
    stopChat: () => void
  }
  assistantProfile?: { name: string; avatarPath?: string | null; emoji?: string | null }
  onSend: (
    text: string,
    attachments?: unknown[],
    searchMode?: boolean,
    meta?: {
      displayText?: string
      skillRefs?: Array<{ command: string; content: string }>
      fileRefs?: PromptFileRef[]
      delivery?: 'steer' | 'queue'
    }
  ) => boolean | void | Promise<boolean | void>
  onEditResend?: (
    userMessageId: string,
    newText: string,
    meta?: { skillRefs?: Array<{ command: string; content: string }>; fileRefs?: PromptFileRef[] }
  ) => boolean | Promise<boolean>
  onAssistantTap: () => void
  assistantName: string
  /** 回滚成功后回填输入框 */
  composerRefill?: {
    text: string
    skillRefs?: Array<{ command: string; content: string }>
    nonce: number
  } | null
  /** 输入区上方插槽（如 Agent Gate Dock） */
  gateSlot?: React.ReactNode
  /** 有待确认 Gate 时禁用 composer */
  gateBlocksComposer?: boolean
  pendingAsk?: AgentGateRequest | null
  isAskReplying?: boolean
  onAskReply?: (payload: AgentGateReplyPayload) => void | Promise<void>
}

export interface WorkbenchAgentPanelHandle {
  addFileContext: (ref: PromptFileRef & { filePath?: string }) => void
}

export const WorkbenchAgentPanel = forwardRef<WorkbenchAgentPanelHandle, WorkbenchAgentPanelProps>(
  function WorkbenchAgentPanel({
  width,
  workspace,
  hasWorkspace,
  hasConfiguredModel,
  sessionId,
  sessions,
  loadingSessions,
  onSelectChange,
  onReviewAll,
  sessionsViewActive = false,
  onToggleSessionsView,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  recentFilePaths = [],
  onOpenFile,
  chrome,
  chat,
  stream,
  assistantProfile,
  onSend,
  onEditResend,
  onAssistantTap,
  assistantName,
  composerRefill = null,
  gateSlot,
  gateBlocksComposer = false,
  pendingAsk = null,
  isAskReplying = false,
  onAskReply
}, ref) {
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const modelBtnRef = useRef<HTMLButtonElement>(null)
  const inputBarRef = useRef<InputBarRef>(null)
  const messageListRef = useRef<AgentWorkspaceMessageListHandle>(null)

  useImperativeHandle(
    ref,
    () => ({
      addFileContext: (next) => inputBarRef.current?.addFileContext(next)
    }),
    []
  )
  const [notebookMountOpen, setNotebookMountOpen] = useState(false)
  const [pendingQueue, setPendingQueue] = useState<Array<{ id: string; text: string }>>([])
  const [showShortcutManager, setShowShortcutManager] = useState(false)
  const [workspaceShortcuts, setWorkspaceShortcuts] = useState<PromptShortcut[]>([])
  const inputPlaceholder = useWorkbenchInputPlaceholder()
  const resolveDropAttachments = useMemo(
    () => createWorkspaceComposerDropResolver(workspace?.folderRoot ?? null),
    [workspace?.folderRoot]
  )
  const fileMention = useMemo(
    () =>
      workspace?.folderRoot
        ? {
            enabled: true,
            recentPaths: recentFilePaths,
            onOpenFile,
            searchFiles: (query: string) =>
              searchWorkspaceFileNames({
                folderRoot: workspace.folderRoot,
                query,
                listDir: (rootPath, relativePath) =>
                  window.api.agentWorkspace.listDir(rootPath, relativePath)
              })
          }
        : undefined,
    [onOpenFile, recentFilePaths, workspace?.folderRoot]
  )
  const {
    shortcuts,
    loadShortcuts,
    addShortcut,
    updateShortcut,
    removeShortcut
  } = usePromptShortcutStore()
  const { searchMode, toggleSearchMode } = usePersistedSearchMode()

  useEffect(() => {
    void loadShortcuts()
  }, [loadShortcuts])

  useEffect(() => {
    const folderRoot = workspace?.folderRoot
    if (!folderRoot) {
      setWorkspaceShortcuts([])
      return
    }
    let cancelled = false
    const listWorkspace = (
      window.api as {
        skills?: { listWorkspace?: (root: string) => Promise<import('@baishou/shared').AgentSkill[]> }
      }
    ).skills?.listWorkspace

    const loadWorkspaceShortcuts = () => {
      if (!listWorkspace) {
        if (!cancelled) setWorkspaceShortcuts([])
        return
      }
      void listWorkspace(folderRoot)
        .then((skills) => {
          if (cancelled) return
          setWorkspaceShortcuts(skills.map(skillToPromptShortcut))
        })
        .catch(() => {
          if (!cancelled) setWorkspaceShortcuts([])
        })
    }

    loadWorkspaceShortcuts()
    const onSkillsChanged = () => {
      void loadShortcuts()
      loadWorkspaceShortcuts()
    }
    let treeTimer: ReturnType<typeof setTimeout> | null = null
    const onTreeRefresh = () => {
      if (treeTimer) clearTimeout(treeTimer)
      treeTimer = setTimeout(() => {
        treeTimer = null
        loadWorkspaceShortcuts()
      }, 100)
    }
    const unsubSkills = (
      window.api as { skills?: { onChanged?: (cb: () => void) => () => void } }
    ).skills?.onChanged?.(onSkillsChanged)
    window.addEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
    return () => {
      cancelled = true
      unsubSkills?.()
      window.removeEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
      if (treeTimer) clearTimeout(treeTimer)
    }
  }, [workspace?.folderRoot, loadShortcuts])

  const composerShortcuts = useMemo(
    () => [...shortcuts, ...workspaceShortcuts],
    [shortcuts, workspaceShortcuts]
  )

  useEffect(() => {
    if (!sessionId) {
      setPendingQueue([])
      return
    }
    const refreshPending = async () => {
      try {
        const list = await window.api.agentWorkspace.listPendingInputs(sessionId)
        setPendingQueue(
          list.map((item) => ({
            id: item.id,
            text: item.text
          }))
        )
      } catch {
        setPendingQueue([])
      }
    }
    void refreshPending()
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ sessionId?: string }>).detail
      if (detail?.sessionId && detail.sessionId !== sessionId) return
      void refreshPending()
    }
    window.addEventListener('baishou:workspace-pending-inputs-changed', onChanged)
    return () => window.removeEventListener('baishou:workspace-pending-inputs-changed', onChanged)
  }, [sessionId, stream.isStreaming])

  useEffect(() => {
    if (!composerRefill) return
    inputBarRef.current?.restoreDraft({
      text: composerRefill.text,
      skillRefs: composerRefill.skillRefs
    })
  }, [composerRefill])

  const workspaceMessages = chat.messages as WorkspaceChatMessage[]

  const providerIconUrl = useMemo(() => {
    if (!isConfiguredProviderId(chrome.currentProviderId)) return undefined
    const providerRecord = chrome.providers.find((provider) => provider.id === chrome.currentProviderId)
    return (
      getProviderIcon(chrome.currentProviderId, isDark) ||
      (providerRecord?.type ? getProviderIcon(providerRecord.type, isDark) : undefined)
    )
  }, [chrome.currentProviderId, chrome.providers, isDark])

  const displayModelName =
    formatDialogueModelLabel(chrome.currentModelId) ?? t('agent.no_model_selected', '暂未选择模型')
  const noModelSelected = !isConfiguredProviderId(chrome.currentProviderId) || !chrome.currentModelId
  const lastRoundUsage = useMemo(() => pickLastRoundUsage(workspaceMessages), [workspaceMessages])
  const contextWindow = getModelContextWindow(chrome.currentModelId)
  const assistantAvatar = resolveDesktopAssistantAvatarSrc(chrome.currentAssistant?.avatarPath)
  const displayAssistantName = chrome.currentAssistant?.name || assistantName
  const headerTitle = useMemo(() => {
    if (sessionsViewActive) {
      return t('workbench.session_history', '历史会话')
    }
    const active = sessions.find((item) => item.sessionId === sessionId)
    const title = active?.title?.trim()
    if (title) return title
    if (sessionId && sessionId !== 'new-session') {
      return t('workbench.session_untitled', '新会话')
    }
    return t('workbench.session_untitled', '新会话')
  }, [sessionId, sessions, sessionsViewActive, t])

  const footer = (
    <div className={styles.metaRow}>
      <div className={styles.metaLeading}>
        <button
          type="button"
          className={styles.metaChip}
          onClick={onAssistantTap}
          aria-haspopup="dialog"
          aria-label={t('agent.select_assistant', '选择伙伴')}
          title={t('agent.select_assistant', '选择伙伴')}
        >
          <span className={styles.assistantAvatar} aria-hidden>
            <img
              key={chrome.currentAssistant?.avatarPath ?? chrome.currentAssistant?.id ?? 'default'}
              src={assistantAvatar}
              alt=""
            />
          </span>
          <span className={styles.metaChipLabel}>{displayAssistantName}</span>
          <ChevronDown size={12} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className={styles.metaTrailing}>
        <button
          ref={modelBtnRef}
          type="button"
          className={`${chromeStyles.modelSwitcherTrigger} ${chromeStyles.modelSwitcherInMeta}`}
          onClick={() => chrome.onModelClick(modelBtnRef.current?.getBoundingClientRect() ?? null)}
          aria-label={t('models.switch_model', '切换模型')}
          title={displayModelName}
        >
          <span className={chromeStyles.modelProviderIcon} aria-hidden>
            {providerIconUrl ? (
              <img src={providerIconUrl} alt="" />
            ) : noModelSelected ? (
              <Sparkles size={15} />
            ) : (
              <Cloud size={15} />
            )}
          </span>
          <span className={chromeStyles.modelName}>{displayModelName}</span>
          {chrome.effortSuffix ? (
            <span className={chromeStyles.modelEffort}>{chrome.effortSuffix}</span>
          ) : null}
          <span className={chromeStyles.chevron}>▼</span>
        </button>
        {hasWorkspace ? (
          <ContextUsageRing
            lastRound={lastRoundUsage}
            contextWindow={contextWindow}
            cumulative={{
              inputTokens: exclusiveInputTokens(
                chrome.totalInputTokens,
                chrome.totalCacheReadInputTokens,
                chrome.totalCacheWriteInputTokens
              ),
              outputTokens: chrome.totalOutputTokens,
              cacheReadTokens: chrome.totalCacheReadInputTokens,
              cacheWriteTokens: chrome.totalCacheWriteInputTokens,
              estimatedCost: `$${chrome.estimatedCost.toFixed(6)}`
            }}
            pricingLastUpdated={chrome.pricingLastUpdated}
            onRefreshPricing={chrome.onRefreshPricing}
          />
        ) : null}
      </div>
    </div>
  )

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <span className={styles.headerTitle} title={headerTitle}>
          {headerTitle}
        </span>
        {hasWorkspace ? (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.headerIconBtn}
              title={t('agent_workspace.new_session', '新建会话')}
              onClick={onNewSession}
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden />
            </button>
            {onToggleSessionsView ? (
              <button
                type="button"
                className={`${styles.headerIconBtn} ${sessionsViewActive ? styles.headerIconBtnActive : ''}`}
                title={t('workbench.session_history', '历史会话')}
                aria-pressed={sessionsViewActive}
                onClick={onToggleSessionsView}
              >
                <MessagesSquare size={16} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {sessionsViewActive ? (
        <div className={styles.sessionsBody}>
          <WorkbenchSessionView
            workspace={workspace}
            sessions={sessions}
            activeSessionId={sessionId}
            loadingSessions={loadingSessions}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
          />
        </div>
      ) : (
        <>
          <div className={styles.chatBody}>
            {!hasWorkspace ? (
              <p className={styles.hint}>
                {t('agent_workspace.pick_workspace_hint', '请先选择或添加工作区')}
              </p>
            ) : (
              <AgentWorkspaceMessageList
                key={sessionId ?? 'workspace-chat'}
                ref={messageListRef}
                sessionId={sessionId}
                messages={workspaceMessages}
                pendingAssistantMsg={chat.pendingAssistantMsg as any}
                streamingText={stream.text}
                streamingReasoning={stream.reasoning}
                streamingTimeline={stream.timeline}
                isStreaming={stream.isStreaming}
                isBridgeActive={stream.isBridgeActive}
                streamError={stream.error}
                activeToolName={stream.activeToolName}
                completedTools={stream.completedTools as any}
                failedTools={stream.failedTools as any}
                assistantProfile={assistantProfile}
                hasMore={chat.hasMore}
                onLoadMore={chat.loadMore}
                onEditResend={onEditResend}
                onOpenFile={onOpenFile}
                onSelectChange={onSelectChange}
                onReviewAll={onReviewAll}
                pendingAsk={pendingAsk}
                isAskReplying={isAskReplying}
                onAskReply={onAskReply}
              />
            )}
          </div>

          {hasWorkspace ? (
            <div className={styles.inputArea}>
              {!hasConfiguredModel ? (
                <p className={styles.noModelHint} role="status">
                  {t(
                    'agent_workspace.no_model_send_hint',
                    '请先选择一个对话模型，然后才能发送消息。'
                  )}
                </p>
              ) : null}
              {gateSlot}
              {pendingQueue.length > 0 ? (
                <div className={styles.runtimeQueueBar} role="status">
                  <ul className={styles.pendingList}>
                    {pendingQueue.map((item) => (
                      <li key={item.id} className={styles.pendingItem}>
                        <span className={styles.pendingText}>
                          {item.text.trim()
                            ? item.text.slice(0, 80)
                            : t('input.upload_attachment', '上传附件')}
                        </span>
                        <button
                          type="button"
                          className={styles.pendingCancel}
                          onClick={async () => {
                            await window.api.agentWorkspace.cancelPendingInput(item.id)
                            window.dispatchEvent(
                              new CustomEvent('baishou:workspace-pending-inputs-changed', {
                                detail: { sessionId }
                              })
                            )
                            window.dispatchEvent(
                              new CustomEvent('baishou:workspace-messages-changed', {
                                detail: { sessionId }
                              })
                            )
                          }}
                        >
                          {t('common.cancel', '取消')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <KnowledgeMountHint
                sessionId={sessionId}
                onOpen={() => setNotebookMountOpen(true)}
              />
              <InputBar
                ref={inputBarRef}
                isLoading={stream.isStreaming}
                allowSendWhileLoading
                attachmentIntake="workspace"
                resolveDropAttachments={resolveDropAttachments}
                fileMention={fileMention}
                composerBlocked={!hasConfiguredModel || gateBlocksComposer}
                onSend={async (text, attachments, searchMode, meta) => {
                  messageListRef.current?.beginFollowIfAtBottom()
                  const accepted = await onSend(text, attachments, searchMode, {
                    ...meta,
                    delivery: stream.isStreaming ? 'queue' : undefined
                  })
                  return accepted !== false
                }}
                onStop={stream.stopChat}
                shortcuts={composerShortcuts}
                createSkillScope="workspace"
                onManageShortcuts={() => setShowShortcutManager(true)}
                searchMode={searchMode}
                onToggleSearchMode={toggleSearchMode}
                placeholder={inputPlaceholder}
                onOpenNotebookMount={() => setNotebookMountOpen(true)}
                footer={footer}
              />
            </div>
          ) : null}
        </>
      )}

      <ShortcutManagerDialog
        isOpen={showShortcutManager}
        onClose={() => setShowShortcutManager(false)}
        shortcuts={shortcuts as PromptShortcut[]}
        onAdd={addShortcut}
        onUpdate={updateShortcut}
        onDelete={removeShortcut}
        onSelect={(shortcut) => {
          setShowShortcutManager(false)
          inputBarRef.current?.applySkillRef(shortcut)
        }}
      />

      <WorkbenchNotebookMountDialog
        open={notebookMountOpen}
        sessionId={sessionId}
        onClose={() => setNotebookMountOpen(false)}
      />
    </aside>
  )
})
