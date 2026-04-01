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
            取消撤离
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
  const totalMessages = sessions.reduce((acc, curr) => acc + (curr.messageCount || 0), 0);
  const activeAssistants = new Set(sessions.map(s => s.assistantName)).size;

  return (
    <div className={styles.statsPanel}>
       <div className={styles.statCard}>
          <div className={styles.statLabel}>总机承载会话数</div>
          <div className={styles.statValue}>
             {sessions.length} <span className={styles.statTrend}>↑ 2%</span>
          </div>
       </div>
       <div className={styles.statCard}>
          <div className={styles.statLabel}>脑部神经突触 (总消息)</div>
          <div className={styles.statValue}>
             {totalMessages} <span className={styles.statTrend}>↑ 活跃</span>
          </div>
       </div>
       <div className={styles.statCard}>
          <div className={styles.statLabel}>动用的具象化分身 (Agents)</div>
          <div className={styles.statValue}>
             {activeAssistants} <span>/ 15</span>
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

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className={styles.page}>
      
      {/* 顶控大盘 App Bar */}
      <div className={styles.appBar}>
        <span className={styles.appBarTitle}>
          <ListChecks size={28} color="var(--color-primary)" />
          {t('agent.sessions.management_title', '全系会话监控网 (Sessions Audit)')}
        </span>
        <div className={styles.appBarActions}>
          <button className={`${styles.actionBtn} ${styles.actionBtnOutline}`} title="导出快照备份">
             <ArrowDownToLine size={16} /> 数据外溢
          </button>

          {isMultiSelect ? (
            <>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={selectAll}
              >
                全域圈定
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
                onClick={clearSelection}
              >
                取消
              </button>
              {selectedIds.size > 0 && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={() => setDeleteTarget({ type: 'multiple' })}
                >
                  <Trash2 size={16} /> 重置 ({selectedIds.size})
                </button>
              )}
            </>
          ) : (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
              onClick={() => setIsMultiSelect(true)}
            >
              <ListChecks size={16} /> 批处理编队
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
               placeholder="通过代号或神经元探踪遗留物..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
            />
         </div>
         <div 
           className={`${styles.filterTag} ${filterMode === 'all' ? styles.filterTagActive : ''}`}
           onClick={() => setFilterMode('all')}
         >全时域</div>
         <div 
           className={`${styles.filterTag} ${filterMode === 'pinned' ? styles.filterTagActive : ''}`}
           onClick={() => setFilterMode('pinned')}
         >已钉选靶点 📌</div>
      </div>

      {/* 演算总盘 Stats Board */}
      <StatsDashboard sessions={sessions} />

      {/* 会话矩阵 List */}
      <div className={styles.sessionListContainer}>
        {filteredAndSortedSessions.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🕳️</span>
            <span className={styles.emptyText}>
              {t('agent.sessions.empty', '此区域已成为物理虚空。没有任何记录...')}
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
                      {session.title || t('agent.sessions.new_chat', '游离的对话节点')}
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
                    <span>{session.messageCount} 个上下文交汇</span>
                    <span className={styles.sessionMetaDot} />
                    <span>{formatDate(session.updatedAt)}</span>
                  </div>
                </div>

                {!isMultiSelect && (
                  <div className={styles.sessionActions}>
                    <button
                      className={styles.sessionActionBtn}
                      title={ session.isPinned ? '取消强力锚定' : '强力锚定' }
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinToggle(session.id);
                      }}
                    >
                      {session.isPinned ? '📌' : '📍'}
                    </button>
                    <button
                      className={`${styles.sessionActionBtn} ${styles.sessionActionBtnDanger}`}
                      title="格式化粉碎"
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
            ? `确已判定粉碎 ${selectedIds.size} 个神经节点阵列？`
            : '格式化并粉碎此突触？'
        }
        message="协议生效后，其内部包含的所有记忆标记均永久脱离宇宙网，无法复原！"
        confirmLabel="抹除此痕迹"
        isDanger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
