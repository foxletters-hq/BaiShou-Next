import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      backgroundColor: 'var(--color-primary-container, #e0f2fe)',
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
}) => {
  const navigate = useNavigate();
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 与原版 Flutter 对齐的用户昵称 fallback
  const userNickname = '天光晓';
  const userAvatarChar = userNickname.charAt(0);

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
        <div className={styles.brandText}>伙伴</div>
        {/* 折叠按钮 — 仅桌面端显示 */}
        {onCollapse && (
          <button className={styles.collapseBtn} onClick={onCollapse} title="折叠侧边栏">
            <MdMenu size={20} />
          </button>
        )}
      </div>

      {/* 可滚动主体 */}
      <div className={styles.scroller}>
        {/* ─── 当前伙伴槽位 — 原版永远显示，即使 loading 也显示 placeholder ─── */}
        <div className={styles.currentAssistantWrapper}>
          <div
            className={styles.currentAssistantCard}
            onClick={() => currentAssistant && onAssistantSwitched(currentAssistant)}
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

        {/* ─── 新对话按钮 — 原版 FilledButton padding:vertical:14 ─── */}
        <div className={styles.newChatWrapper}>
          <button className={styles.newChatBtn} onClick={onNewSession}>
            <MdAdd size={18} />
            <span>新对话</span>
          </button>
        </div>

        {/* ─── 功能选项区 SidebarMenuItem 风格 ─── */}
        <div className={styles.menuItemRow} onClick={() => navigate('/settings')}>
          <div className={styles.menuItemRowInner}>
            <MdSettings size={20} className={styles.menuItemRowIcon} />
            <span>系统设置</span>
          </div>
        </div>

        {/* 小间距 */}
        <div style={{ height: 8 }} />

        {/* ─── 对话历史区标题 — labelSmall + letterSpacing:0.5 ─── */}
        <div className={styles.historyHeader}>
          <span>最近对话</span>
          {sessions.length > 0 && (
            <button className={styles.multiSelectToggle} onClick={toggleMultiSelect} title="多选">
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
            placeholder="搜索近期聊天..."
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
            <div className={styles.emptyHint}>加载中...</div>
          ) : sessions.length === 0 ? (
            <div className={styles.emptyHint}>暂无近期对话，快点开始一个吧~</div>
          ) : (
            sessions.map(session => (
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
            ))
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
              {selectedIds.size === sessions.length ? '取消全选' : '全选'}
            </button>
            <div style={{ flex: 1 }} />
            <button
              className={styles.batchDeleteBtn}
              disabled={selectedIds.size === 0}
              onClick={handleBatchDelete}
            >
              删除 ({selectedIds.size})
            </button>
          </div>
        )}

        {/* 底部用户卡片 — 原版 padding:16, r=18 头像, 1px 分割线 0.3 alpha */}
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>{userAvatarChar}</div>
          <div className={styles.userName}>{userNickname}</div>
        </div>
      </div>
    </div>
  );
};
