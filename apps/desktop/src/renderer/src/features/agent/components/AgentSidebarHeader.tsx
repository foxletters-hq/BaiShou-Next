import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MdUnfoldMore, MdAdd, MdSettings, MdChecklist } from 'react-icons/md'
import { resolveWebAssistantAvatarSrc } from '@baishou/ui'
import type { AgentAssistant } from './AgentSidebar'
import styles from './AgentSidebar.module.css'
import { rememberSettingsReturnPath } from '../../settings/settings-navigation.util'

interface AssistantAvatarProps {
  assistant: AgentAssistant
  size: number
}

/** 助手头像：内置预设 / 本地上传 */
const AssistantAvatar: React.FC<AssistantAvatarProps> = ({ assistant, size }) => {
  const shellStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  return (
    <div style={shellStyle}>
      <img
        src={resolveWebAssistantAvatarSrc(assistant.avatarPath)}
        alt={assistant.name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block'
        }}
      />
    </div>
  )
}

interface AgentSidebarHeaderProps {
  currentAssistant?: AgentAssistant
  pinnedAssistants: AgentAssistant[]
  searchQuery: string
  hasSessions: boolean
  isMultiSelect: boolean
  onSearchQueryChanged: (q: string) => void
  onNewSession: (assistantId?: string) => void
  onAssistantSwitched: (assistant: AgentAssistant) => void
  onShowPicker?: () => void
  onToggleMultiSelect: () => void
}

/**
 * 侧边栏顶部固定区域。
 * 包含：助手卡片、置顶助手行、新对话按钮、设置入口、历史标题、搜索框。
 */
export const AgentSidebarHeader: React.FC<AgentSidebarHeaderProps> = ({
  currentAssistant,
  pinnedAssistants,
  searchQuery,
  hasSessions,
  isMultiSelect,
  onSearchQueryChanged,
  onNewSession,
  onAssistantSwitched,
  onShowPicker,
  onToggleMultiSelect
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <>
      {/* ─── 当前助手槽位 ─── */}
      <div className={styles.currentAssistantWrapper}>
        <div
          className={styles.currentAssistantCard}
          onClick={() => {
            if (onShowPicker) onShowPicker()
            else if (currentAssistant) onAssistantSwitched(currentAssistant)
          }}
        >
          {currentAssistant ? (
            <>
              <AssistantAvatar assistant={currentAssistant} size={36} />
              <div className={styles.assistantInfo}>
                <div className={styles.assistantName}>{currentAssistant.name}</div>
                {currentAssistant.description && (
                  <div className={styles.assistantDesc}>{currentAssistant.description}</div>
                )}
              </div>
              <MdUnfoldMore className={styles.unfoldIcon} />
            </>
          ) : (
            /* Loading 骨架态 */
            <>
              <div className={styles.avatarSkeleton} />
              <div className={styles.assistantInfo}>
                <div className={styles.skeletonLine} style={{ width: 80 }} />
                <div className={styles.skeletonLine} style={{ width: 60, marginTop: 4 }} />
              </div>
              <MdUnfoldMore className={styles.unfoldIcon} style={{ opacity: 0.3 }} />
            </>
          )}
        </div>
      </div>

      {/* ─── 置顶助手行 ─── */}
      <div className={styles.pinnedRow}>
        {pinnedAssistants.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary, #94a3b8)',
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {t('agent.sidebar.pin_hint', '这里可以置顶伙伴')}
          </div>
        )}
        {pinnedAssistants.map((assistant) => {
          const isSelected = currentAssistant?.id === assistant.id
          return (
            <div
              key={assistant.id}
              className={`${styles.pinnedAvatarWrapper} ${isSelected ? styles.selected : ''}`}
              title={assistant.name}
              onClick={() => {
                if (!isSelected) onAssistantSwitched(assistant)
              }}
            >
              <AssistantAvatar assistant={assistant} size={40} />
            </div>
          )
        })}
      </div>

      <div style={{ height: 4 }} />

      {/* ─── 新对话按钮 ─── */}
      <div className={styles.newChatWrapper}>
        <button className={styles.newChatBtn} onClick={() => onNewSession(currentAssistant?.id)}>
          <MdAdd size={18} />
          <span>{t('agent.sessions.new_chat', '新对话')}</span>
        </button>
      </div>

      {/* ─── 设置入口 ─── */}
      <div
        className={styles.menuItemRow}
        onClick={() => {
          rememberSettingsReturnPath(location.pathname)
          navigate('/settings')
        }}
      >
        <div className={styles.menuItemRowInner}>
          <MdSettings size={20} className={styles.menuItemRowIcon} />
          <span>{t('settings.title', '系统设置')}</span>
        </div>
      </div>

      {/* ─── 历史对话区标题 ─── */}
      <div className={styles.historyHeader}>
        <span>{t('agent.sidebar.recent_chats', '最近对话')}</span>
        {hasSessions && (
          <button
            className={styles.multiSelectToggle}
            onClick={onToggleMultiSelect}
            title={t('common.multi_select', '多选')}
          >
            <MdChecklist
              size={16}
              color={
                isMultiSelect ? 'var(--color-error, #ef4444)' : 'var(--text-secondary, #94a3b8)'
              }
            />
          </button>
        )}
      </div>

      {/* ─── 搜索框 ─── */}
      <div className={styles.searchWrapper}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder={t('agent.sidebar.search_hint', '搜索近期聊天...')}
          value={searchQuery}
          onChange={(e) => onSearchQueryChanged(e.target.value)}
        />
        {searchQuery && (
          <button className={styles.searchClearBtn} onClick={() => onSearchQueryChanged('')}>
            ✕
          </button>
        )}
      </div>
    </>
  )
}
