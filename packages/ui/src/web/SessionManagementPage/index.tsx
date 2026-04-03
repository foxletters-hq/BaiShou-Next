import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ListChecks, ArrowDownToLine, Trash2 } from 'lucide-react';
import styles from './SessionManagementPage.module.css';

// ─── 类型定义 ──────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  title: string;
  assistantName: string;
  assistantEmoji: string;
  messageCount: number;
  isPinned: boolean;
  updatedAt: Date;
}

export interface SessionManagementPageProps {
  sessions: SessionInfo[];
  onSessionTap: (session: SessionInfo) => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteMultiple: (sessionIds: string[]) => void;
  onPinToggle: (sessionId: string) => void;
  onRename: (sessionId: string, newTitle: string) => void;
}

// ─── 确认对话框 ──────────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  isDanger = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <div className={styles.dialogOverlay} onClick={onCancel}>
      <div className={styles.dialogBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogTitle}>{title}</div>
        <div className={styles.dialogText}>{message}</div>
        <div className={styles.dialogActions}>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
            onClick={onCancel}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            className={`${styles.actionBtn} ${isDanger ? styles.actionBtnDanger : styles.actionBtnPrimary}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── 统计仪表盘子件 ────────────────────────────────────────────

const StatsDashboard: React.FC<{ sessions: SessionInfo[] }> = ({ sessions }) => {
  const { t } = useTranslation();
  const totalMessages = sessions.reduce((acc, curr) => acc + (curr.messageCount || 0), 0);
  const activeAssistants = new Set(sessions.map(s => s.assistantName)).size;

  return (
    <div className={styles.statsPanel}>
       <div className={styles.statCard}>
          <div className={styles.statLabel}>{t('agent.sessions.total_count', '会话总数')}</div>
          <div className={styles.statValue}>
             {sessions.length}
          </div>
       </div>
       <div className={styles.statCard}>
          <div className={styles.statLabel}>{t('agent.sessions.total_messages', '总消息数')}</div>
          <div className={styles.statValue}>
             {totalMessages}
          </div>
       </div>
       <div className={styles.statCard}>
          <div className={styles.statLabel}>{t('agent.sessions.active_agents', '活跃伙伴数')}</div>
          <div className={styles.statValue}>
             {activeAssistants}
          </div>
       </div>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────

export const SessionManagementPage: React.FC<SessionManagementPageProps> = ({
  sessions,
  onSessionTap,
  onDeleteSession,
  onDeleteMultiple,
  onPinToggle,
}) => {
  const { t } = useTranslation();
  
  // 过滤与搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pinned'>('all');

  // 多选与弹出框状态
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'single' | 'multiple';
    id?: string;
  } | null>(null);

  // 打捞与排序核心算法
  const filteredAndSortedSessions = useMemo(() => {
    let result = [...sessions];
    
    // 标签过滤
    if (filterMode === 'pinned') {
       result = result.filter(s => s.isPinned);
    }

    // 搜索词汇过滤
    if (searchQuery.trim()) {
       const q = searchQuery.toLowerCase();
       result = result.filter(s => 
          s.title.toLowerCase().includes(q) || 
          s.assistantName.toLowerCase().includes(q)
       );
    }

    // 按 pinned → 更新时间排序
    return result.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [sessions, filterMode, searchQuery]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAndSortedSessions.map((s) => s.id)));
  }, [filteredAndSortedSessions]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsMultiSelect(false);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'single' && deleteTarget.id) {
      onDeleteSession(deleteTarget.id);
    } else if (deleteTarget.type === 'multiple') {
      onDeleteMultiple([...selectedIds]);
      clearSelection();
    }
    setDeleteTarget(null);
  }, [deleteTarget, selectedIds, onDeleteSession, onDeleteMultiple, clearSelection]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return t('common.today', '今天');
    if (days === 1) return t('common.yesterday', '昨天');
    if (days < 7) return `${days}${t('common.days_ago', '天前')}`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className={styles.page}>
      
      {/* 顶控大盘 App Bar */}
      <div className={styles.appBar}>
        <span className={styles.appBarTitle}>
          <ListChecks size={28} color="var(--color-primary)" />
          {t('agent.sessions.management_title', '会话管理')}
        </span>
        <div className={styles.appBarActions}>
          <button className={`${styles.actionBtn} ${styles.actionBtnOutline}`} title={t('common.export', '导出')}>
             <ArrowDownToLine size={16} /> {t('common.export', '导出')}
          </button>

          {isMultiSelect ? (
            <>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={selectAll}
              >
                {t('agent.chat.select_all', '全选')}
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
                onClick={clearSelection}
              >
                {t('common.cancel', '取消')}
              </button>
              {selectedIds.size > 0 && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={() => setDeleteTarget({ type: 'multiple' })}
                >
                  <Trash2 size={16} /> {t('common.delete', '删除')} ({selectedIds.size})
                </button>
              )}
            </>
          ) : (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
              onClick={() => setIsMultiSelect(true)}
            >
              <ListChecks size={16} /> {t('agent.sessions.batch_manage', '批量管理')}
            </button>
          )}
        </div>
      </div>

      {/* 搜索与过滤卡槽 */}
      <div className={styles.filterBar}>
         <div className={styles.searchBox}>
            <Search size={16} color="var(--text-secondary)" style={{marginRight: 8}} />
            <input 
               className={styles.searchInput}
               placeholder={t('common.search_hint', '搜索记忆...')} 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
            />
         </div>
         <div 
           className={`${styles.filterTag} ${filterMode === 'all' ? styles.filterTagActive : ''}`}
           onClick={() => setFilterMode('all')}
         >{t('common.view_all', '查看全部')}</div>
         <div 
           className={`${styles.filterTag} ${filterMode === 'pinned' ? styles.filterTagActive : ''}`}
           onClick={() => setFilterMode('pinned')}
         >{t('agent.sessions.pinned_only', '已置顶 📌')}</div>
      </div>

      {/* 演算总盘 Stats Board */}
      <StatsDashboard sessions={sessions} />

      {/* 会话矩阵 List */}
      <div className={styles.sessionListContainer}>
        {filteredAndSortedSessions.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🕳️</span>
            <span className={styles.emptyText}>
              {t('agent.sessions.empty', '暂无会话记录...')}
            </span>
          </div>
        ) : (
          <div className={styles.sessionList}>
            {filteredAndSortedSessions.map((session) => (
              <div
                key={session.id}
                className={`${styles.sessionCard} ${
                  selectedIds.has(session.id) ? styles.sessionCardSelected : ''
                }`}
                onClick={() =>
                  isMultiSelect
                    ? toggleSelect(session.id)
                    : onSessionTap(session)
                }
              >
                {isMultiSelect && (
                  <input
                    type="checkbox"
                    className={styles.sessionCheckbox}
                    checked={selectedIds.has(session.id)}
                    onChange={() => toggleSelect(session.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                <div className={styles.sessionInfo}>
                  <div className={styles.sessionTitleRow}>
                    <span className={styles.sessionTitle}>
                      {session.title || t('agent.chat.new_chat_label', '新对话')}
                    </span>
                    {session.isPinned && (
                      <span className={styles.sessionPinBadge}>📌</span>
                    )}
                  </div>
                  <div className={styles.sessionMeta}>
                    <span>
                      {session.assistantEmoji} {session.assistantName}
                    </span>
                    <span className={styles.sessionMetaDot} />
                    <span>{session.messageCount} {t('common.count_items').replace('$count', '')}</span>
                    <span className={styles.sessionMetaDot} />
                    <span>{formatDate(session.updatedAt)}</span>
                  </div>
                </div>

                {!isMultiSelect && (
                  <div className={styles.sessionActions}>
                    <button
                      className={styles.sessionActionBtn}
                      title={ session.isPinned ? t('agent.sessions.unpin', '取消置顶') : t('agent.sessions.pin', '置顶') }
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinToggle(session.id);
                      }}
                    >
                      {session.isPinned ? '📌' : '📍'}
                    </button>
                    <button
                      className={`${styles.sessionActionBtn} ${styles.sessionActionBtnDanger}`}
                      title={t('common.delete', '删除')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ type: 'single', id: session.id });
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={
          deleteTarget?.type === 'multiple'
            ? t('agent.chat.delete_confirm_multi', `确定删除 $count 个对话？此操作不可撤销。`).replace('$count', selectedIds.size.toString())
            : t('summary.delete_confirm_title', '确认删除')
        }
        message={t('settings.attachment_delete_selected_confirm', '确定要删除吗？此操作不可撤销。').replace(/\$count/g, (deleteTarget?.type === 'multiple' ? selectedIds.size : 1).toString())}
        confirmLabel={t('common.delete', '删除')}
        isDanger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
