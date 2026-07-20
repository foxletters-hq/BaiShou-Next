import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MessagesSquare, Plus } from 'lucide-react'
import type {
  AgentWorkspaceEntry,
  AgentWorkspaceSessionListItem,
  WorkspaceChangeEntry
} from '@baishou/shared'
import { InputBar } from '@baishou/ui'
import { AgentWorkspaceChatBar } from '../components/AgentWorkspaceChatBar'
import { AgentWorkspaceMessageList } from '../components/AgentWorkspaceMessageList'
import { WorkbenchAgentChangesSummary } from './WorkbenchAgentChangesSummary'
import { WorkbenchSessionView } from './WorkbenchSessionView'
import { workspaceEntryMatchesFolder } from '../utils/workspace-display.util'
import styles from './WorkbenchAgentPanel.module.css'

export interface WorkbenchAgentPanelProps {
  width: number
  workspace: AgentWorkspaceEntry | null
  hasWorkspace: boolean
  hasConfiguredModel: boolean
  sessionId?: string
  sessions: AgentWorkspaceSessionListItem[]
  loadingSessions?: boolean
  changes: WorkspaceChangeEntry[]
  onSelectChange: (change: WorkspaceChangeEntry) => void
  sessionsViewActive?: boolean
  onToggleSessionsView?: () => void
  onNewSession: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession?: (sessionId: string, title: string) => void
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
    estimatedCost: number
    onAssistantClick: () => void
    onModelClick: () => void
    onCostClick: () => void
  }
  chat: {
    messages: unknown[]
    pendingAssistantMsg: unknown
  }
  stream: {
    text: string
    reasoning: string
    isStreaming: boolean
    error: string | null
    activeToolName: string | null
    completedTools: unknown[]
    failedTools: unknown[]
    stopChat: () => void
  }
  assistantProfile?: { name: string; avatarPath?: string | null; emoji?: string | null }
  onSend: (text: string) => void | Promise<void>
  onRollbackRound: (userMessageId: string) => void
  onChangesUpdate: (changes: WorkspaceChangeEntry[]) => void
  onAssistantTap: () => void
  assistantName: string
}

export const WorkbenchAgentPanel: React.FC<WorkbenchAgentPanelProps> = ({
  width,
  workspace,
  hasWorkspace,
  hasConfiguredModel,
  sessionId,
  sessions,
  loadingSessions,
  changes,
  onSelectChange,
  sessionsViewActive = false,
  onToggleSessionsView,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  chrome,
  chat,
  stream,
  assistantProfile,
  onSend,
  onRollbackRound,
  onChangesUpdate,
  onAssistantTap,
  assistantName
}) => {
  const { t } = useTranslation()

  const defaultSessionTitle = t('agent.sessions.default_title', '新对话')

  const currentSessionTitle = useMemo(() => {
    if (!sessionId || sessionId === 'new-session' || !workspace) return null
    const match = sessions.find(
      (session) =>
        session.sessionId === sessionId &&
        workspaceEntryMatchesFolder(workspace, session.folderRoot)
    )
    return match?.title?.trim() || defaultSessionTitle
  }, [defaultSessionTitle, sessionId, sessions, workspace])

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t('nav.agent', '伙伴')}</span>
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
          {!sessionsViewActive && currentSessionTitle ? (
            <div className={styles.currentSessionBar}>
              <span className={styles.currentSessionLabel}>
                {t('workbench.current_session', '当前会话')}
              </span>
              <span className={styles.currentSessionName}>{currentSessionTitle}</span>
            </div>
          ) : null}

          <AgentWorkspaceChatBar
            currentAssistant={chrome.currentAssistant}
            currentProviderId={chrome.currentProviderId}
            currentModelId={chrome.currentModelId}
            providers={chrome.providers}
            inputTokens={chrome.totalInputTokens}
            outputTokens={chrome.totalOutputTokens}
            costMicros={chrome.estimatedCost * 1_000_000}
            onAssistantClick={chrome.onAssistantClick}
            onModelClick={chrome.onModelClick}
            onCostClick={chrome.onCostClick}
            changesPanelCollapsed
          />

          <div className={styles.chatBody}>
            {!hasWorkspace ? (
              <p className={styles.hint}>
                {t('agent_workspace.pick_workspace_hint', '请先选择或添加工作区')}
              </p>
            ) : !sessionId || sessionId === 'new-session' ? (
              <p className={styles.hint}>
                {t('agent_workspace.select_session_hint', '在下方输入开始新对话。')}
              </p>
            ) : (
              <AgentWorkspaceMessageList
                sessionId={sessionId}
                messages={chat.messages as any}
                pendingAssistantMsg={chat.pendingAssistantMsg as any}
                streamingText={stream.text}
                streamingReasoning={stream.reasoning}
                isStreaming={stream.isStreaming}
                streamError={stream.error}
                activeToolName={stream.activeToolName}
                completedTools={stream.completedTools as any}
                failedTools={stream.failedTools as any}
                assistantProfile={assistantProfile}
                onRollbackRound={onRollbackRound}
                onChangesUpdate={onChangesUpdate}
              />
            )}
          </div>

          <WorkbenchAgentChangesSummary changes={changes} onSelectChange={onSelectChange} />

          {hasWorkspace ? (
            <div className={styles.inputArea}>
              {!hasConfiguredModel ? (
                <p className={styles.noModelHint} role="status">
                  {t(
                    'agent_workspace.no_model_send_hint',
                    '请先在顶部选择一个对话模型，然后才能发送消息。'
                  )}
                </p>
              ) : null}
              <InputBar
                isLoading={stream.isStreaming}
                composerBlocked={!hasConfiguredModel}
                onSend={async (text) => {
                  await onSend(text)
                  return true
                }}
                onStop={stream.stopChat}
                assistantName={assistantName}
                onAssistantTap={onAssistantTap}
              />
            </div>
          ) : null}
        </>
      )}
    </aside>
  )
}
