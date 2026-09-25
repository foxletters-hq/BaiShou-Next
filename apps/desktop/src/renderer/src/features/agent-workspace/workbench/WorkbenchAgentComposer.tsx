import React from 'react'
import { useTranslation } from 'react-i18next'
import { Cloud, ChevronDown, Sparkles } from 'lucide-react'
import type { PromptFileRef } from '@baishou/shared'
import {
  InputBar,
  SessionContextUsageRing,
  type InputBarRef,
  type PromptShortcut
} from '@baishou/ui'
import chromeStyles from '../../agent/components/AgentChatChrome.module.css'
import type { AgentWorkspaceMessageListHandle } from '../components/AgentWorkspaceMessageList'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'
import { KnowledgeMountHint } from '../../knowledge/KnowledgeMountHint'
import styles from './WorkbenchAgentPanel.module.css'

export function WorkbenchAgentComposerFooter({
  onAssistantTap,
  assistantAvatar,
  assistantAvatarKey,
  displayAssistantName,
  modelBtnRef,
  onModelClick,
  providerIconUrl,
  noModelSelected,
  displayModelName,
  effortSuffix,
  hasWorkspace,
  workspaceMessages,
  chrome
}: {
  onAssistantTap: () => void
  assistantAvatar: string
  assistantAvatarKey: string
  displayAssistantName: string
  modelBtnRef: React.RefObject<HTMLButtonElement | null>
  onModelClick: () => void
  providerIconUrl?: string
  noModelSelected: boolean
  displayModelName: string
  effortSuffix?: string | null
  hasWorkspace: boolean
  workspaceMessages: WorkspaceChatMessage[]
  chrome: {
    currentModelId: string
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadInputTokens: number
    totalCacheWriteInputTokens: number
    estimatedCost: number
    pricingLastUpdated?: Date | null
    onRefreshPricing?: () => Promise<{ success: boolean; error?: string }>
  }
}) {
  const { t } = useTranslation()
  return (
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
            <img key={assistantAvatarKey} src={assistantAvatar} alt="" />
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
          onClick={onModelClick}
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
          {effortSuffix ? <span className={chromeStyles.modelEffort}>{effortSuffix}</span> : null}
          <span className={chromeStyles.chevron}>▼</span>
        </button>
        <SessionContextUsageRing
          hidden={!hasWorkspace}
          messages={workspaceMessages}
          modelId={chrome.currentModelId}
          totals={{
            totalInputTokens: chrome.totalInputTokens,
            totalOutputTokens: chrome.totalOutputTokens,
            totalCacheReadInputTokens: chrome.totalCacheReadInputTokens,
            totalCacheWriteInputTokens: chrome.totalCacheWriteInputTokens,
            estimatedCost: chrome.estimatedCost
          }}
          pricingLastUpdated={chrome.pricingLastUpdated}
          onRefreshPricing={chrome.onRefreshPricing}
        />
      </div>
    </div>
  )
}

export function WorkbenchAgentComposer({
  hasConfiguredModel,
  gateSlot,
  pendingQueue,
  sessionId,
  assistantId,
  onOpenNotebookMount,
  inputBarRef,
  messageListRef,
  stream,
  resolveDropAttachments,
  fileMention,
  gateBlocksComposer,
  onSend,
  composerShortcuts,
  onManageShortcuts,
  searchMode,
  onToggleSearchMode,
  inputPlaceholder,
  footer
}: {
  hasConfiguredModel: boolean
  gateSlot?: React.ReactNode
  pendingQueue: Array<{ id: string; text: string }>
  sessionId?: string
  assistantId?: string | null
  onOpenNotebookMount: () => void
  inputBarRef: React.RefObject<InputBarRef | null>
  messageListRef: React.RefObject<AgentWorkspaceMessageListHandle | null>
  stream: {
    isStreaming: boolean
    stopChat: () => void
  }
  resolveDropAttachments?: React.ComponentProps<typeof InputBar>['resolveDropAttachments']
  fileMention?: React.ComponentProps<typeof InputBar>['fileMention']
  gateBlocksComposer: boolean
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
  composerShortcuts: PromptShortcut[]
  onManageShortcuts: () => void
  searchMode: boolean
  onToggleSearchMode: () => void
  inputPlaceholder: string
  footer: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.inputArea}>
      {!hasConfiguredModel ? (
        <p className={styles.noModelHint} role="status">
          {t('agent_workspace.no_model_send_hint', '请先选择一个对话模型，然后才能发送消息。')}
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
        assistantId={assistantId}
        scope="workbench"
        onOpen={onOpenNotebookMount}
      />
      <InputBar
        ref={inputBarRef}
        isLoading={stream.isStreaming}
        allowSendWhileLoading
        attachmentIntake="workspace"
        resolveDropAttachments={resolveDropAttachments}
        fileMention={fileMention}
        composerBlocked={!hasConfiguredModel || gateBlocksComposer}
        onSend={async (text, attachments, nextSearchMode, meta) => {
          messageListRef.current?.beginFollowIfAtBottom()
          const accepted = await onSend(text, attachments, nextSearchMode, {
            ...meta,
            delivery: stream.isStreaming ? 'queue' : undefined
          })
          return accepted !== false
        }}
        onStop={stream.stopChat}
        shortcuts={composerShortcuts}
        createSkillScope="workspace"
        onManageShortcuts={onManageShortcuts}
        searchMode={searchMode}
        onToggleSearchMode={onToggleSearchMode}
        placeholder={inputPlaceholder}
        onOpenNotebookMount={onOpenNotebookMount}
        footer={footer}
      />
    </div>
  )
}
