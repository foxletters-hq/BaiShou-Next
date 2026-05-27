import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MdAutoAwesome, MdUnfoldMore, MdAdd, MdSettings } from 'react-icons/md'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { AgentAssistant } from './AgentSidebar'
import styles from './AgentSidebar.module.css'

interface AssistantAvatarProps {
  assistant: AgentAssistant
  size: number
}

/** 助手头像：支持图片路径或 emoji fallback */
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

  if (assistant.avatarPath && assistant.avatarPath !== 'default') {
    return (
      <div style={shellStyle}>
        <img
          src={assistant.avatarPath}
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
  return (
    <div style={{ ...shellStyle, backgroundColor: 'transparent', fontSize: size * 0.5 }}>
      {assistant.emoji || '🤖'}
    </div>
  )
}

interface AgentSidebarHeaderProps {
  currentAssistant?: AgentAssistant
  pinnedAssistants: AgentAssistant[]
  searchQuery: string
  isCollapsed: boolean
  hasSessions: boolean
  isMultiSelect: boolean
  onSearchQueryChanged: (q: string) => void
  onNewSession: (assistantId?: string) => void
  onAssistantSwitched: (assistant: AgentAssistant) => void
  onShowPicker?: () => void
  onCollapse?: () => void
  onExpand?: () => void
  onToggleMultiSelect: () => void
}

/**
 * 侧边栏顶部固定区域。
 * 包含：品牌行、助手卡片、置顶助手行、新对话按钮、设置入口、历史标题、搜索框。
 */
export const AgentSidebarHeader: React.FC<AgentSidebarHeaderProps> = ({
  currentAssistant,
  pinnedAssistants,
  searchQuery,
  isCollapsed,
  hasSessions,
  isMultiSelect,
  onSearchQueryChanged,
  onNewSession,
  onAssistantSwitched,
  onShowPicker,
  onCollapse,
  onExpand,
  onToggleMultiSelect
}) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <>
      {/* ─── 顶部品牌行 ─── */}
      <div className={styles.brandRow}>
        <div className={styles.brandInfo}>
          <div className={styles.brandIconBox}>
            <MdAutoAwesome className={styles.brandIcon} />
          </div>
          <span className={styles.brandText}>{t('agent.partner_label', '伙伴')}</span>
        </div>
        {onCollapse && onExpand && (
          <button
            className={styles.toggleBtn}
            onClick={isCollapsed ? onExpand : onCollapse}
            title={
              isCollapsed
                ? t('agent.sidebar.expand', '展开侧边栏')
                : t('agent.sidebar.collapse', '折叠侧边栏')
            }
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}
      </div>

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
      <div className={styles.menuItemRow} onClick={() => navigate('/settings')}>
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
            <span
              style={{
                fontSize: 16,
                color: isMultiSelect
                  ? 'var(--color-error, #ef4444)'
                  : 'var(--text-secondary, #94a3b8)'
              }}
            >
              ☑
            </span>
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
