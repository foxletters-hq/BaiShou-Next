import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
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
   * full: 整条顶栏（含左侧伙伴）
   * floatingActions: 右上角用量 + 新对话（有对话后；历史在输入栏伙伴旁）
   */
  variant?: 'full' | 'floatingActions'
}

export const AgentChatChrome: React.FC<AgentChatChromeProps> = ({
  currentAssistant,
  onShowPicker,
  onAssistantSwitched,
  onNewSession,
  trailingControls,
  variant = 'full'
}) => {
  const { t } = useTranslation()

  const newSessionBtn = (
    <button
      type="button"
      className={styles.iconBtn}
      title={t('agent.sessions.new_chat', '新对话')}
      aria-label={t('agent.sessions.new_chat', '新对话')}
      onClick={onNewSession}
    >
      <Plus size={18} />
    </button>
  )

  const actions = (
    <>
      {trailingControls}
      {newSessionBtn}
    </>
  )

  if (variant === 'floatingActions') {
    return <div className={styles.floatingActions}>{actions}</div>
  }

  return (
    <div className={styles.chrome}>
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
    </div>
  )
}
