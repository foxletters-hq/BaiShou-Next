import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SessionListItem } from '@baishou/ui';
import type { SessionData } from '@baishou/ui';
import { MdAutoAwesome, MdUnfoldMore, MdAdd, MdSettings, MdChecklist, MdMenu } from 'react-icons/md';
import styles from './AgentSidebar.module.css';

export interface AgentAssistant {
  id: string;
  name: string;
  description?: string;
  avatarPath?: string;
  emoji?: string;
}

export interface AgentSidebarProps {
  currentAssistant?: AgentAssistant;
  sessions: SessionData[];
  isLoading?: boolean;
  selectedSessionId?: string;
  searchQuery?: string;
  hasMore?: boolean;
  scrollKey?: number;
  pinnedAssistants?: AgentAssistant[];
  onSearchQueryChanged: (q: string) => void;
  onLoadMore?: () => void;
  onSessionSelected: (id: string) => void;
  onNewSession: () => void;
  onAssistantSwitched: (assistant: AgentAssistant) => void;
  onPinSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onRenameSession?: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onCollapse?: () => void;
  onShowPicker?: () => void;
}

// 原版 buildAssistantAvatar 逻辑 — 支持图片路径或 emoji fallback
const AssistantAvatar: React.FC<{ assistant: AgentAssistant; size: number }> = ({ assistant, size }) => {
  if (assistant.avatarPath && assistant.avatarPath !== 'default') {
    return (
      <img
        src={assistant.avatarPath}
        alt={assistant.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.5,
      flexShrink: 0,
    }}>
      {assistant.emoji || '🤖'}
    </div>
  );
};

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  currentAssistant,
  sessions,
  isLoading = false,
  selectedSessionId,
  searchQuery = '',
  pinnedAssistants = [],
  onSearchQueryChanged,
  onSessionSelected,
  onNewSession,
  onAssistantSwitched,
  onPinSession,
  onDeleteSession,
  onRenameSession,
  onBatchDelete,
  onCollapse,
  onShowPicker,
  hasMore,
  scrollKey,
  onLoadMore,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollKey && scrollKey > 0 && scrollerRef.current) {
      scrollerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollKey]);


  const handleBatchDelete = () => {
    if (selectedIds.size > 0 && onBatchDelete) {
      onBatchDelete(Array.from(selectedIds));
      setIsMultiSelect(false);
      setSelectedIds(new Set());
    }
  };

  const toggleMultiSelect = () => {
    setIsMultiSelect(prev => !prev);
    setSelectedIds(new Set());
  };

  return (
    <div className={styles.sidebar}>
      {/* ─── 顶部品牌区 padding: fromLTRB(20,20,20,12) ─── */}
      <div className={styles.brandRow}>
        <div className={styles.brandIconBox}>
          <MdAutoAwesome className={styles.brandIcon} />
        </div>
        <div className={styles.brandText}>{t('agent.partner_label', '伙伴')}</div>
        {/* 折叠按钮 — 仅桌面端显示 */}
        {onCollapse && (
          <button className={styles.collapseBtn} onClick={onCollapse} title={t('agent.sidebar.collapse', '折叠侧边栏')}>
            <MdMenu size={20} />
          </button>
        )}
      </div>

      {/* 可滚动主体 */}
      <div className={styles.scroller} ref={scrollerRef}>
        {/* ─── 当前伙伴槽位 — 原版永远显示，即使 loading 也显示 placeholder ─── */}
        <div className={styles.currentAssistantWrapper}>
          <div
            className={styles.currentAssistantCard}
            onClick={() => {
              if (onShowPicker) {
                onShowPicker();
              } else if (currentAssistant) {
                onAssistantSwitched(currentAssistant);
              }
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

        <div className={styles.pinnedRow}>
          {pinnedAssistants.length === 0 && (
             <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', flex: 1 }}>
               {t('agent.sidebar.pin_hint', '这里可以置顶伙伴')}
             </div>
          )}
          {pinnedAssistants.map(assistant => {
            const isSelected = currentAssistant?.id === assistant.id;
            return (
              <div
                key={assistant.id}
                className={`${styles.pinnedAvatarWrapper} ${isSelected ? styles.selected : ''}`}
                title={assistant.name}
                onClick={() => {
                  if (!isSelected) {
                    onAssistantSwitched(assistant);
                  }
                }}
              >
                <AssistantAvatar assistant={assistant} size={40} />
              </div>
            );
          })}
        </div>

        <div style={{ height: 4 }} />

        {/* ─── 新对话按钮 — 原版 FilledButton padding:vertical:14 ─── */}
        <div className={styles.newChatWrapper}>
          <button className={styles.newChatBtn} onClick={onNewSession}>
            <MdAdd size={18} />
            <span>{t('agent.sessions.new_chat', '新对话')}</span>
          </button>
        </div>

        {/* ─── 功能选项区 SidebarMenuItem 风格 ─── */}
        <div className={styles.menuItemRow} onClick={() => navigate('/settings')}>
          <div className={styles.menuItemRowInner}>
            <MdSettings size={20} className={styles.menuItemRowIcon} />
            <span>{t('settings.title', '系统设置')}</span>
          </div>
        </div>

        {/* 小间距 */}
        <div style={{ height: 8 }} />

        {/* ─── 对话历史区标题 — labelSmall + letterSpacing:0.5 ─── */}
        <div className={styles.historyHeader}>
          <span>{t('agent.sidebar.recent_chats', '最近对话')}</span>
          {sessions.length > 0 && (
            <button className={styles.multiSelectToggle} onClick={toggleMultiSelect} title={t('common.multi_select', '多选')}>
              <MdChecklist
                size={16}
                color={isMultiSelect ? 'var(--color-error, #ef4444)' : 'var(--text-secondary, #94a3b8)'}
              />
            </button>
          )}
        </div>

        {/* ─── 搜索框 — 无边框，底色填充，isDense ─── */}
        <div className={styles.searchWrapper}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={t('agent.sidebar.search_hint', '搜索近期聊天...')}
            value={searchQuery}
            onChange={e => onSearchQueryChanged(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.searchClearBtn} onClick={() => onSearchQueryChanged('')}>✕</button>
          )}
        </div>

        {/* ─── 对话列表 ─── */}
        <div className={styles.sessionList}>
          {isLoading ? (
            <div className={styles.emptyHint}>{t('common.loading', '加载中...')}</div>
          ) : sessions.length === 0 ? (
            <div className={styles.emptyHint}>{t('agent.sidebar.no_recent_chats', '暂无近期对话，快点开始一个吧~')}</div>
          ) : (
            <>
              {sessions
                .filter(session => !searchQuery || session.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(session => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  isSelected={session.id === selectedSessionId}
                  isMultiSelect={isMultiSelect}
                  isChecked={selectedIds.has(session.id)}
                  onTap={() => {
                    if (isMultiSelect) {
                      const next = new Set(selectedIds);
                      if (next.has(session.id)) next.delete(session.id);
                      else next.add(session.id);
                      setSelectedIds(next);
                    } else {
                      onSessionSelected(session.id);
                    }
                  }}
                  onPin={onPinSession ? () => onPinSession(session.id) : undefined}
                  onRename={onRenameSession ? () => onRenameSession(session.id) : undefined}
                  onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
                  onCheckChanged={checked => {
                    const next = new Set(selectedIds);
                    if (checked) next.add(session.id);
                    else next.delete(session.id);
                    setSelectedIds(next);
                  }}
                />
              ))}
              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', marginTop: '8px' }}>
                  <button 
                    onClick={onLoadMore}
                    style={{ 
                      background: 'transparent', border: 'none', 
                      color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, 
                      cursor: 'pointer', opacity: 0.8 
                    }}
                  >
                    {t('agent.sidebar.load_more', '加载更多对话')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部弹性空白区 */}
        <div style={{ flex: 1 }} />
      </div>

      {/* ─── 固定底部区 ─── */}
      <div className={styles.bottomArea}>
        {/* 批量删除操作栏 */}
        {isMultiSelect && sessions.length > 0 && (
          <div className={styles.batchBar}>
            <button
              className={styles.selectAllBtn}
              onClick={() => {
                if (selectedIds.size === sessions.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(sessions.map(s => s.id)));
              }}
            >
              {selectedIds.size === sessions.length ? t('agent.chat.cancel_select_all', '取消全选') : t('agent.chat.select_all', '全选')}
            </button>
            <div style={{ flex: 1 }} />
            <button
              className={styles.batchDeleteBtn}
              disabled={selectedIds.size === 0}
              onClick={handleBatchDelete}
            >
              {t('common.delete', '删除')} ({selectedIds.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
