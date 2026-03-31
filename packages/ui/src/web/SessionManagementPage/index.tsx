import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
            取消
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

// ─── 主组件 ──────────────────────────────────────────────────

export const SessionManagementPage: React.FC<SessionManagementPageProps> = ({
  sessions,
  onSessionTap,
  onDeleteSession,
  onDeleteMultiple,
  onPinToggle,
  onRename: _onRename,
}) => {
  const { t } = useTranslation();
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'single' | 'multiple';
    id?: string;
  } | null>(null);

  // 按 pinned → 更新时间排序
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [sessions]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sessions.map((s) => s.id)));
  }, [sessions]);

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
      {/* App Bar */}
      <div className={styles.appBar}>
        <span className={styles.appBarTitle}>
          {t('agent.sessions.management_title', '会话管理')}
        </span>
        <div className={styles.appBarActions}>
          {isMultiSelect ? (
            <>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
                onClick={selectAll}
              >
                全选
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
                  onClick={() =>
                    setDeleteTarget({ type: 'multiple' })
                  }
                >
                  🗑️ 删除 ({selectedIds.size})
                </button>
              )}
            </>
          ) : (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
              onClick={() => setIsMultiSelect(true)}
            >
              ☑️ 多选
            </button>
          )}
        </div>
      </div>

      {/* Session List */}
      {sortedSessions.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>💬</span>
          <span className={styles.emptyText}>
            {t('agent.sessions.empty', '暂无会话记录')}
          </span>
        </div>
      ) : (
        <div className={styles.sessionList}>
          {sortedSessions.map((session) => (
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
                    {session.title || t('agent.sessions.new_chat', '新对话')}
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
                  <span>{session.messageCount} 条消息</span>
                  <span className={styles.sessionMetaDot} />
                  <span>{formatDate(session.updatedAt)}</span>
                </div>
              </div>

              {!isMultiSelect && (
                <div className={styles.sessionActions}>
                  <button
                    className={styles.sessionActionBtn}
                    title={
                      session.isPinned ? '取消置顶' : '置顶'
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinToggle(session.id);
                    }}
                  >
                    {session.isPinned ? '📌' : '📍'}
                  </button>
                  <button
                    className={`${styles.sessionActionBtn} ${styles.sessionActionBtnDanger}`}
                    title="删除"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({
                        type: 'single',
                        id: session.id,
                      });
                    }}
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={
          deleteTarget?.type === 'multiple'
            ? `删除 ${selectedIds.size} 个会话？`
            : '删除此会话？'
        }
        message="删除后无法恢复，所有消息记录都将丢失。"
        confirmLabel="确认删除"
        isDanger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
