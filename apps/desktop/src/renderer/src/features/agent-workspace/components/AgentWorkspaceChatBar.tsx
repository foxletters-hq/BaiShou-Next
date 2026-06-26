import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MdAutoAwesome, MdDifference } from 'react-icons/md'
import { TokenBadge, resolveDesktopAssistantAvatarSrc, useTheme, getProviderIcon } from '@baishou/ui'
import { formatDialogueModelLabel, isConfiguredProviderId } from '@baishou/shared'

import styles from './AgentWorkspaceChatBar.module.css'

export interface AgentWorkspaceChatBarAssistant {
  id?: string
  name: string
  avatarPath?: string
}

export interface AgentWorkspaceChatBarProps {
  currentAssistant?: AgentWorkspaceChatBarAssistant
  currentProviderId: string
  currentModelId: string
  providers: Array<{ id: string; type?: string }>
  inputTokens: number
  outputTokens: number
  costMicros: number
  onAssistantClick: () => void
  onModelClick: () => void
  onCostClick: () => void
  changesPanelCollapsed?: boolean
  onToggleChangesPanel?: () => void
}

export const AgentWorkspaceChatBar: React.FC<AgentWorkspaceChatBarProps> = ({
  currentAssistant,
  currentProviderId,
  currentModelId,
  providers,
  inputTokens,
  outputTokens,
  costMicros,
  onAssistantClick,
  onModelClick,
  onCostClick,
  changesPanelCollapsed = true,
  onToggleChangesPanel
}) => {
  const { t } = useTranslation()
  const { isDark } = useTheme()

  const providerIconUrl = useMemo(() => {
    if (!isConfiguredProviderId(currentProviderId)) return undefined
    const providerRecord = providers.find((provider) => provider.id === currentProviderId)
    return (
      getProviderIcon(currentProviderId, isDark) ||
      (providerRecord?.type ? getProviderIcon(providerRecord.type, isDark) : undefined)
    )
  }, [currentProviderId, providers, isDark])

  const displayModelName =
    formatDialogueModelLabel(currentModelId) ??
    t('agent.no_model_selected', '暂未选择模型')

  const assistantName = currentAssistant?.name || t('agent.partner_label', '伙伴')
  const assistantAvatar = resolveDesktopAssistantAvatarSrc(currentAssistant?.avatarPath)

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.assistantBtn}
          onClick={onAssistantClick}
          title={t('agent.select_assistant', '选择伙伴')}
        >
          <span className={styles.assistantAvatar} aria-hidden>
            <img
              key={currentAssistant?.avatarPath ?? currentAssistant?.id ?? 'default'}
              src={assistantAvatar}
              alt=""
            />
          </span>
          <span className={styles.assistantName}>{assistantName}</span>
          <span className={styles.chevron}>▼</span>
        </button>
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={`${styles.modelSwitcherTrigger} ${styles.chip}`}
          onClick={onModelClick}
        >
          <span className={styles.modelProviderIcon} aria-hidden>
            {providerIconUrl ? <img src={providerIconUrl} alt="" /> : <MdAutoAwesome size={18} />}
          </span>
          <span className={styles.modelName}>{displayModelName}</span>
          <span className={styles.chevron}>▼</span>
        </button>
        <TokenBadge
          className={styles.chip}
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          costMicros={costMicros}
          onClick={onCostClick}
        />
        {onToggleChangesPanel ? (
          <button
            type="button"
            className={`${styles.changesPanelBtn} ${styles.chip} ${
              !changesPanelCollapsed ? styles.changesPanelBtnActive : ''
            }`}
            onClick={onToggleChangesPanel}
            title={
              changesPanelCollapsed
                ? t('agent_workspace.expand_changes_panel', '展开变更面板')
                : t('agent_workspace.collapse_changes_panel', '收起变更面板')
            }
            aria-pressed={!changesPanelCollapsed}
          >
            <MdDifference size={18} aria-hidden />
          </button>
        ) : null}
      </div>
    </header>
  )
}
