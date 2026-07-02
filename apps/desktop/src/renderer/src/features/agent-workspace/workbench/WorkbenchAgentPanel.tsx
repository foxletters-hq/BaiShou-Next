import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { InputBar } from '@baishou/ui'
import { AgentWorkspaceChatBar } from '../components/AgentWorkspaceChatBar'
import { AgentWorkspaceMessageList } from '../components/AgentWorkspaceMessageList'
import { WorkbenchAgentChangesSummary } from './WorkbenchAgentChangesSummary'
import styles from './WorkbenchAgentPanel.module.css'

export interface WorkbenchAgentPanelProps {
  collapsed: boolean
  width: number
  onToggleCollapsed: () => void
  hasWorkspace: boolean
  hasConfiguredModel: boolean
  sessionId?: string
  changes: WorkspaceChangeEntry[]
  onSelectChange: (change: WorkspaceChangeEntry) => void
  chrome: {
    currentAssistant?: { id: string; name: string; avatarPath?: string | null }
    currentProviderId: string
    currentModelId: string
    providers: Array<{ id: string; name?: string; type?: string; models?: string[]; enabledModels?: string[] }>
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
  onSend: (text: string) => void
  onRollbackRound: (userMessageId: string) => void
  onChangesUpdate: (changes: WorkspaceChangeEntry[]) => void
  onAssistantTap: () => void
  assistantName: string
}

export const WorkbenchAgentPanel: React.FC<WorkbenchAgentPanelProps> = ({
  collapsed,
  width,
  onToggleCollapsed,
  hasWorkspace,
  hasConfiguredModel,
  sessionId,
  changes,
  onSelectChange,
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

  if (collapsed) {
    return (
      <div className={styles.collapsedRail}>
        <button
          type="button"
          className={styles.expandBtn}
          onClick={onToggleCollapsed}
          title={t('workbench.expand_agent', '展开 Agent 面板')}
        >
          <MdChevronLeft size={20} />
        </button>
      </div>
    )
  }

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t('nav.agent', '伙伴')}</span>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapsed}
          title={t('workbench.collapse_agent', '收起 Agent 面板')}
        >
          <MdChevronRight size={20} />
        </button>
      </div>

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
          <p className={styles.hint}>{t('agent_workspace.pick_workspace_hint', '请先选择或添加工作区')}</p>
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
              {t('agent_workspace.no_model_send_hint', '请先在顶部选择一个对话模型，然后才能发送消息。')}
            </p>
          ) : null}
          <div className={!hasConfiguredModel ? styles.inputBlocked : undefined}>
            <InputBar
              isLoading={stream.isStreaming}
              onSend={onSend}
              onStop={stream.stopChat}
              assistantName={assistantName}
              onAssistantTap={onAssistantTap}
            />
          </div>
        </div>
      ) : null}
    </aside>
  )
}
