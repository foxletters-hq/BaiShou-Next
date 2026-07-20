import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GraduationCap, MessageSquareText, Plus } from 'lucide-react'
import type { AgentAssistant } from './AgentSidebar'
import { CurrentAssistantSlot } from './AgentSidebarHeader'
import styles from './AgentChatChrome.module.css'

export interface AgentChatChromeProps {
  currentAssistant?: AgentAssistant
  onShowPicker?: () => void
  onAssistantSwitched: (assistant: AgentAssistant) => void
  onNewSession: () => void
  onOpenSessions: () => void
  /** 模型切换、用量等（与会话按钮同一顶栏） */
  trailingControls?: React.ReactNode
}

export const AgentChatChrome: React.FC<AgentChatChromeProps> = ({
  currentAssistant,
  onShowPicker,
  onAssistantSwitched,
  onNewSession,
  onOpenSessions,
  trailingControls
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

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

      <div className={styles.right}>
        {trailingControls}
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
          title={t('agent.sessions.new_chat', '新对话')}
          aria-label={t('agent.sessions.new_chat', '新对话')}
          onClick={onNewSession}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={t('agent.sidebar.recent_chats', '最近对话')}
          aria-label={t('agent.sidebar.recent_chats', '最近对话')}
          onClick={onOpenSessions}
        >
          <MessageSquareText size={18} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={t('agent.assistant.settings_entry', '伙伴管理')}
          aria-label={t('agent.assistant.settings_entry', '伙伴管理')}
          onClick={() => navigate('/assistants')}
        >
          <GraduationCap size={18} />
        </button>
      </div>
    </div>
  )
}
