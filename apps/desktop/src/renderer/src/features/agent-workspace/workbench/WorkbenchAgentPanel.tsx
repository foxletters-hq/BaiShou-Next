import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatDialogueModelLabel,
  isConfiguredProviderId,
  skillToPromptShortcut
} from '@baishou/shared'
import {
  ShortcutManagerDialog,
  getProviderIcon,
  resolveDesktopAssistantAvatarSrc,
  useTheme,
  type InputBarRef,
  type PromptShortcut
} from '@baishou/ui'
import { usePromptShortcutStore } from '@baishou/store'
import { usePersistedSearchMode } from '../../agent/hooks/usePersistedSearchMode'
import {
  AgentWorkspaceMessageList,
  type AgentWorkspaceMessageListHandle
} from '../components/AgentWorkspaceMessageList'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'
import { useWorkbenchInputPlaceholder } from '../utils/workbench-input-placeholder'
import { createWorkspaceComposerDropResolver } from '../utils/workspace-composer-drop.util'
import { searchWorkspaceFileNames } from '../utils/workspace-file-mention-search.util'
import type {
  WorkbenchAgentPanelHandle,
  WorkbenchAgentPanelProps
} from './WorkbenchAgentPanel.types'
import { useWorkbenchAgentPanelDrop } from './useWorkbenchAgentPanelDrop'
import { WorkbenchSessionView } from './WorkbenchSessionView'
import { WorkbenchNotebookMountDialog } from './WorkbenchNotebookMountDialog'
import { WorkbenchAgentPanelHeader } from './WorkbenchAgentPanelHeader'
import { WorkbenchAgentComposer, WorkbenchAgentComposerFooter } from './WorkbenchAgentComposer'
import styles from './WorkbenchAgentPanel.module.css'

export type {
  WorkbenchAgentPanelHandle,
  WorkbenchAgentPanelProps
} from './WorkbenchAgentPanel.types'

export const WorkbenchAgentPanel = forwardRef<WorkbenchAgentPanelHandle, WorkbenchAgentPanelProps>(
  function WorkbenchAgentPanel(
    {
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
      bubbleActions,
      onAssistantTap,
      assistantName,
      composerRefill = null,
      gateSlot,
      gateBlocksComposer = false,
      pendingAsk = null,
      isAskReplying = false,
      onAskReply
    },
    ref
  ) {
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
    const ingestPanelDrop = useCallback((dataTransfer: DataTransfer) => {
      return inputBarRef.current?.ingestDrop(dataTransfer)
    }, [])
    const { panelDropActive, panelDropProps } = useWorkbenchAgentPanelDrop({
      enabled: hasWorkspace && !sessionsViewActive,
      ingestDrop: ingestPanelDrop
    })

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
    const { shortcuts, loadShortcuts, addShortcut, updateShortcut, removeShortcut } =
      usePromptShortcutStore()
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
          skills?: {
            listWorkspace?: (root: string) => Promise<import('@baishou/shared').AgentSkill[]>
          }
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
      const providerRecord = chrome.providers.find(
        (provider) => provider.id === chrome.currentProviderId
      )
      return (
        getProviderIcon(chrome.currentProviderId, isDark) ||
        (providerRecord?.type ? getProviderIcon(providerRecord.type, isDark) : undefined)
      )
    }, [chrome.currentProviderId, chrome.providers, isDark])

    const displayModelName =
      formatDialogueModelLabel(chrome.currentModelId) ??
      t('agent.no_model_selected', '暂未选择模型')
    const noModelSelected =
      !isConfiguredProviderId(chrome.currentProviderId) || !chrome.currentModelId
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
      <WorkbenchAgentComposerFooter
        onAssistantTap={onAssistantTap}
        assistantAvatar={assistantAvatar}
        assistantAvatarKey={
          chrome.currentAssistant?.avatarPath ?? chrome.currentAssistant?.id ?? 'default'
        }
        displayAssistantName={displayAssistantName}
        modelBtnRef={modelBtnRef}
        onModelClick={() =>
          chrome.onModelClick(modelBtnRef.current?.getBoundingClientRect() ?? null)
        }
        providerIconUrl={providerIconUrl}
        noModelSelected={noModelSelected}
        displayModelName={displayModelName}
        effortSuffix={chrome.effortSuffix}
        hasWorkspace={hasWorkspace}
        workspaceMessages={workspaceMessages}
        chrome={chrome}
      />
    )

    return (
      <aside
        className={`${styles.panel}${panelDropActive ? ` ${styles.panelDropActive}` : ''}`}
        style={{ width }}
        {...panelDropProps}
      >
        {panelDropActive ? (
          <div className={styles.panelDropOverlay} aria-hidden>
            {t('workbench.drop_into_chat', '放到对话中')}
          </div>
        ) : null}
        <WorkbenchAgentPanelHeader
          headerTitle={headerTitle}
          hasWorkspace={hasWorkspace}
          sessionsViewActive={sessionsViewActive}
          onNewSession={onNewSession}
          onToggleSessionsView={onToggleSessionsView}
        />

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
                  bubbleActions={bubbleActions}
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
              <WorkbenchAgentComposer
                hasConfiguredModel={hasConfiguredModel}
                gateSlot={gateSlot}
                pendingQueue={pendingQueue}
                sessionId={sessionId}
                onOpenNotebookMount={() => setNotebookMountOpen(true)}
                inputBarRef={inputBarRef}
                messageListRef={messageListRef}
                stream={stream}
                resolveDropAttachments={resolveDropAttachments}
                fileMention={fileMention}
                gateBlocksComposer={gateBlocksComposer}
                onSend={onSend}
                composerShortcuts={composerShortcuts}
                onManageShortcuts={() => setShowShortcutManager(true)}
                searchMode={searchMode}
                onToggleSearchMode={toggleSearchMode}
                inputPlaceholder={inputPlaceholder}
                footer={footer}
              />
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
  }
)
