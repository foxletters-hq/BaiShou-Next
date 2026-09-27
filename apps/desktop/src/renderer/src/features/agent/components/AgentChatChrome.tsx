import React from 'react'
import { useTranslation } from 'react-i18next'
import { History, Plus } from 'lucide-react'
import type { AgentAssistant } from './AgentSidebar'
import { CurrentAssistantSlot } from './AgentSidebarHeader'
import styles from './AgentChatChrome.module.css'

export interface AgentChatChromeProps {
  currentAssistant?: AgentAssistant
  onShowPicker?: () => void
  onAssistantSwitched: (assistant: AgentAssistant) => void
  onNewSession: () => void
  onOpenSessions?: () => void
  /** 模型切换、用量等（与会话按钮同一顶栏） */
  trailingControls?: React.ReactNode
  /**
   * full: 整条顶栏（含左侧伙伴与右侧会话控制操作组）
   * floatingActions: 悬浮兼容模式
   */
  variant?: 'full' | 'floatingActions'
}

export const AgentChatChrome: React.FC<AgentChatChromeProps> = ({
  currentAssistant,
  onShowPicker,
  onAssistantSwitched,
  onNewSession,
  onOpenSessions,
  trailingControls,
  variant = 'full'
}) => {
  const { t } = useTranslation()

  const historyBtn = onOpenSessions ? (
    <button
      type="button"
      className={`${styles.iconBtn} ${styles.iconOnlyBtn}`}
      title={t('agent.sidebar.recent_chats', '历史记录')}
      aria-label={t('agent.sidebar.recent_chats', '历史记录')}
      onClick={onOpenSessions}
    >
      <History size={16} strokeWidth={2} />
    </button>
  ) : null

  const newSessionBtn = (
    <button
      type="button"
      className={`${styles.iconBtn} ${styles.newChatBtn}`}
      title={t('agent.sessions.new_chat', '新对话')}
      aria-label={t('agent.sessions.new_chat', '新对话')}
      onClick={onNewSession}
    >
      <Plus size={16} strokeWidth={2} />
      <span className={styles.newChatText}>{t('agent.sessions.new_chat', '新对话')}</span>
    </button>
  )

  const actions = (
    <div className={styles.actionGroup}>
      {trailingControls}
      {historyBtn}
      {newSessionBtn}
    </div>
  )

  if (variant === 'floatingActions') {
    return <div className={styles.floatingActions}>{actions}</div>
  }

  return (
    <header className={styles.chrome}>
      <div className={styles.left}>
        <CurrentAssistantSlot
          currentAssistant={currentAssistant}
          onShowPicker={onShowPicker}
          onAssistantSwitched={onAssistantSwitched}
          wrapperClassName={styles.assistantSlot}
          compact
        />
      </div>

      <div className={styles.right}>{actions}</div>
    </header>
  )
}
