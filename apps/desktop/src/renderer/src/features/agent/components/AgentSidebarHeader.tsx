import React, { startTransition } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { resolveDesktopAssistantAvatarSrc, AssistantKindBadge } from '@baishou/ui'
import type { AgentAssistant } from './AgentSidebar'
import styles from './AgentSidebar.module.css'
import { rememberSettingsReturnPath, locationToReturnPath } from '../../settings/settings-navigation.util'
import { prefetchSettingsEntry } from '../../../lib/prefetch-settings-entry'
import { ChevronsUpDown, ListChecks, Plus, Settings } from 'lucide-react'

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
        key={assistant.avatarPath ?? assistant.id}
        src={resolveDesktopAssistantAvatarSrc(assistant.avatarPath)}
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

export interface CurrentAssistantSlotProps {
  currentAssistant?: AgentAssistant
  onShowPicker?: () => void
  onAssistantSwitched: (assistant: AgentAssistant) => void
  wrapperClassName?: string
}

/** 侧边栏顶部的当前伙伴选择槽位 */
export const CurrentAssistantSlot: React.FC<CurrentAssistantSlotProps> = ({
  currentAssistant,
  onShowPicker,
  onAssistantSwitched,
  wrapperClassName
}) => (
  <div className={`${styles.currentAssistantWrapper} ${wrapperClassName ?? ''}`.trim()}>
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
            <div className={styles.assistantNameRow}>
              <div className={styles.assistantName}>{currentAssistant.name}</div>
              <AssistantKindBadge kind={currentAssistant.assistantKind} compact />
            </div>
            {currentAssistant.description && (
              <div className={styles.assistantDesc}>{currentAssistant.description}</div>
            )}
          </div>
          <ChevronsUpDown className={styles.unfoldIcon} />
        </>
      ) : (
        <>
          <div className={styles.avatarSkeleton} />
          <div className={styles.assistantInfo}>
            <div className={styles.skeletonLine} style={{ width: 80 }} />
            <div className={styles.skeletonLine} style={{ width: 60, marginTop: 4 }} />
          </div>
          <ChevronsUpDown className={styles.unfoldIcon} style={{ opacity: 0.3 }} />
        </>
      )}
    </div>
  </div>
)

interface AgentSidebarHeaderProps {
  pinnedAssistants: AgentAssistant[]
  searchQuery: string
  hasSessions: boolean
  isMultiSelect: boolean
  onSearchQueryChanged: (q: string) => void
  onNewSession: (assistantId?: string) => void
  onAssistantSwitched: (assistant: AgentAssistant) => void
  onToggleMultiSelect: () => void
  currentAssistantId?: string
}

/**
 * 侧边栏固定交互区（伙伴选择已上移至侧边栏顶栏）。
 */
export const AgentSidebarHeader: React.FC<AgentSidebarHeaderProps> = ({
  pinnedAssistants,
  searchQuery,
  hasSessions,
  isMultiSelect,
  onSearchQueryChanged,
  onNewSession,
  onAssistantSwitched,
  onToggleMultiSelect,
  currentAssistantId
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <>
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
          const isSelected = currentAssistantId === assistant.id
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

      <div className={styles.newChatWrapper}>
        <button className={styles.newChatBtn} onClick={() => onNewSession(currentAssistantId)}>
          <Plus size={18} />
          <span>{t('agent.sessions.new_chat', '新对话')}</span>
        </button>
      </div>

      <div
        className={styles.menuItemRow}
        onMouseEnter={prefetchSettingsEntry}
        onFocus={prefetchSettingsEntry}
        onClick={() => {
          rememberSettingsReturnPath(locationToReturnPath(location))
          startTransition(() => {
            navigate('/settings/general')
          })
        }}
      >
        <div className={styles.menuItemRowInner}>
          <Settings size={18} className={styles.menuItemRowIcon} />
          <span>{t('settings.title', '系统设置')}</span>
        </div>
      </div>

      <div className={styles.historyHeader}>
        <span>{t('agent.sidebar.recent_chats', '最近对话')}</span>
        {hasSessions && (
          <button
            className={styles.multiSelectToggle}
            onClick={onToggleMultiSelect}
            title={t('common.multi_select', '多选')}
          >
            <ListChecks
              size={16}
              color={
                isMultiSelect ? 'var(--color-error, #ef4444)' : 'var(--text-secondary, #94a3b8)'
              }
            />
          </button>
        )}
      </div>

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
