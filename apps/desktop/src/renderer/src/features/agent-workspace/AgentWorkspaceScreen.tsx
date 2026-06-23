import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { InputBar, AgentGateDock, useDialog } from '@baishou/ui'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { WorkspaceSessionSidebar } from './components/WorkspaceSessionSidebar'
import { WorkspaceChangesPanel } from './components/WorkspaceChangesPanel'
import { AgentWorkspaceMessageList } from './components/AgentWorkspaceMessageList'
import { useWorkspaceAgentStream } from './hooks/useWorkspaceAgentStream'
import { useWorkspaceSessions } from './hooks/useWorkspaceSessions'
import styles from './AgentWorkspaceScreen.module.css'

interface WorkspaceOutletContext {
  folderRoot: string | null
  setFolderRoot: (path: string | null) => void
}

function notifyWorkspaceSessionsChanged(): void {
  window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
}

export const AgentWorkspaceScreen: React.FC = () => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { folderRoot, setFolderRoot } = useOutletContext<WorkspaceOutletContext>()
  const { sessions, loading: loadingSessions } = useWorkspaceSessions()
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [changes, setChanges] = useState<WorkspaceChangeEntry[]>([])
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)

  const stream = useWorkspaceAgentStream(sessionId)

  const folderName = useMemo(() => {
    if (!folderRoot) return undefined
    const match = sessions.find((s) => s.folderRoot === folderRoot)
    if (match?.folderDisplayName) return match.folderDisplayName
    const segments = folderRoot.replace(/\\/g, '/').split('/').filter(Boolean)
    return segments[segments.length - 1]
  }, [folderRoot, sessions])

  const handleChangesUpdate = useCallback((nextChanges: WorkspaceChangeEntry[]) => {
    setChanges(nextChanges)
    setSelectedChangeId((prev) => {
      if (prev && nextChanges.some((c) => c.id === prev)) return prev
      return nextChanges[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    if (!sessionId || sessionId === 'new-session') {
      setChanges([])
      setSelectedChangeId(null)
    }
  }, [sessionId])

  const handlePickWorkspace = useCallback(async () => {
    const picked = await window.api?.agentWorkspace?.pickFolder?.()
    if (picked) {
      setFolderRoot(picked)
      navigate('/agent-workspace')
    }
  }, [navigate, setFolderRoot])

  const handleFolderFocus = useCallback(
    (root: string) => {
      setFolderRoot(root)
    },
    [setFolderRoot]
  )

  const handleNewSession = useCallback(
    (targetFolderRoot: string) => {
      setFolderRoot(targetFolderRoot)
      setSelectedChangeId(null)
      navigate('/agent-workspace')
    },
    [navigate, setFolderRoot]
  )

  const handleSelectSession = useCallback(
    async (targetSessionId: string) => {
      if (targetSessionId === sessionId) return
      try {
        const binding = await window.api.agentWorkspace.getBinding(targetSessionId)
        if (binding?.folderRoot) {
          setFolderRoot(binding.folderRoot)
        }
      } catch {
        /* ignore */
      }
      setSelectedChangeId(null)
      navigate(`/agent-workspace/${targetSessionId}`)
    },
    [navigate, sessionId, setFolderRoot]
  )

  const handleDeleteSession = useCallback(
    async (targetSessionId: string) => {
      const confirmed = await dialog.confirm(
        t('agent_workspace.delete_session_confirm', '确定删除此工作区会话？相关对话记录也会被移除。'),
        t('agent_workspace.delete_session', '删除会话')
      )
      if (!confirmed) return

      try {
        await window.api.agentWorkspace.deleteSession(targetSessionId)
        notifyWorkspaceSessionsChanged()
        if (targetSessionId === sessionId) {
          setSelectedChangeId(null)
          navigate('/agent-workspace')
        }
      } catch (error) {
        console.error('[AgentWorkspaceScreen] delete session failed:', error)
        await dialog.alert(
          t('common.error', '操作失败'),
          t('agent_workspace.delete_session', '删除会话')
        )
      }
    },
    [dialog, navigate, sessionId, t]
  )

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || stream.isStreaming) return
      if (!folderRoot) {
        await handlePickWorkspace()
        return
      }

      try {
        const newSessionId = await stream.startWorkspaceChat(sessionId, trimmed, folderRoot)
        if (newSessionId && newSessionId !== sessionId) {
          navigate(`/agent-workspace/${newSessionId}`)
        }
        notifyWorkspaceSessionsChanged()
      } catch (error) {
        console.error('[AgentWorkspaceScreen] send failed:', error)
      }
    },
    [folderRoot, handlePickWorkspace, navigate, sessionId, stream]
  )

  const handleRollback = useCallback(
    async (userMessageId: string) => {
      if (!sessionId) return

      const confirmed = await dialog.confirm(
        <div>
          <p>{t('round_rollback.confirm_desc', '将恢复本轮对话开始前的文件状态，此操作不可撤销。')}</p>
        </div>,
        t('round_rollback.confirm_title', '回滚本轮变更？')
      )
      if (!confirmed) return

      try {
        await stream.rollbackRound(sessionId, userMessageId)
        notifyWorkspaceSessionsChanged()
        await dialog.alert(
          t('round_rollback.success', '已回滚本轮变更'),
          t('round_rollback.action', '回滚本轮')
        )
      } catch (error) {
        console.error('[AgentWorkspaceScreen] rollback failed:', error)
        await dialog.alert(
          t('round_rollback.failed', '回滚失败'),
          t('round_rollback.action', '回滚本轮')
        )
      }
    },
    [dialog, sessionId, stream, t]
  )

  return (
    <div className={styles.screen}>
      <WorkspaceSessionSidebar
        folderRoot={folderRoot}
        activeSessionId={sessionId}
        sessions={sessions}
        loadingSessions={loadingSessions}
        collapsed={leftCollapsed}
        onToggleCollapsed={() => setLeftCollapsed((v) => !v)}
        onPickFolder={() => void handlePickWorkspace()}
        onFolderFocus={handleFolderFocus}
        onSelectSession={(id) => void handleSelectSession(id)}
        onNewSession={handleNewSession}
        onDeleteSession={(id) => void handleDeleteSession(id)}
      />

      <div className={styles.main}>
        <header className={styles.toolbar}>
          <div className={styles.toolbarMain}>
            <h1 className={styles.title}>{t('nav.agent_workspace', 'Agent')}</h1>
            {folderName ? (
              <span className={styles.workspaceBadge} title={folderRoot ?? undefined}>
                {folderName}
              </span>
            ) : null}
          </div>
          {sessionId && sessionId !== 'new-session' ? (
            <span className={styles.sessionBadge}>{sessionId.slice(0, 8)}</span>
          ) : (
            <span className={styles.sessionBadge}>{t('agent_workspace.new_session', '新会话')}</span>
          )}
        </header>

        <div className={styles.chatStage}>
          {!folderRoot ? (
            <div className={styles.emptyState}>
              <p>{t('agent_workspace.empty_state', '打开左侧文件夹，选择或开始一段 Agent 对话。')}</p>
              <button type="button" className={styles.primaryBtn} onClick={() => void handlePickWorkspace()}>
                {t('agent_workspace.open_folder', '打开文件夹')}
              </button>
            </div>
          ) : !sessionId || sessionId === 'new-session' ? (
            <div className={styles.emptyState}>
              <p>{t('agent_workspace.select_session_hint', '在左侧展开文件夹并选择对话，或在下方输入开始新对话。')}</p>
            </div>
          ) : (
            <AgentWorkspaceMessageList
              sessionId={sessionId}
              streamingText={stream.text}
              isStreaming={stream.isStreaming}
              onRollbackRound={handleRollback}
              onChangesUpdate={handleChangesUpdate}
            />
          )}
        </div>

        <div className={styles.inputArea}>
          <InputBar
            isLoading={stream.isStreaming}
            onSend={(text) => void handleSend(text)}
            onStop={stream.stopChat}
          />
        </div>

        <AgentGateDock
          request={stream.pendingAgentGate}
          isReplying={stream.isAgentGateReplying}
          onReply={(payload) => void stream.replyAgentGate(payload)}
        />
      </div>

      <WorkspaceChangesPanel
        changes={changes}
        selectedChangeId={selectedChangeId}
        onSelectChange={setSelectedChangeId}
        collapsed={rightCollapsed}
        onToggleCollapsed={() => setRightCollapsed((v) => !v)}
      />
    </div>
  )
}
