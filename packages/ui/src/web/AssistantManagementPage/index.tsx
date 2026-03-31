import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AssistantManagementPage.module.css';

// ─── 类型定义 ──────────────────────────────────────────────

export interface AssistantInfo {
  id: string;
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
  contextWindow: number;
  isPinned: boolean;
  providerId?: string;
  modelId?: string;
  compressTokenThreshold: number;
}

export interface AssistantManagementPageProps {
  assistants: AssistantInfo[];
  pinnedIds: Set<string>;
  onEdit: (assistant: AssistantInfo) => void;
  onCreate: () => void;
  onDelete: (assistantId: string) => void;
  onTogglePin: (assistantId: string) => void;
}

// ─── 主组件 ──────────────────────────────────────────────────

export const AssistantManagementPage: React.FC<AssistantManagementPageProps> = ({
  assistants,
  pinnedIds,
  onEdit,
  onCreate,
  onDelete,
  onTogglePin,
}) => {
  const { t } = useTranslation();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      onDelete(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  const formatContextWindow = (n: number) => {
    if (n < 0) return '∞';
    return String(n);
  };

  return (
    <div className={styles.page}>
      {/* App Bar */}
      <div className={styles.appBar}>
        <span className={styles.appBarTitle}>
          {t('agent.assistant.management_title', '伙伴管理')}
        </span>
      </div>

      {/* Card Grid */}
      {assistants.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>✨</span>
          <span className={styles.emptyText}>
            {t('agent.assistant.empty_hint', '还没有创建任何伙伴')}
          </span>
          <button className={styles.emptyBtn} onClick={onCreate}>
            {t('agent.assistant.create_first', '创建第一个伙伴')}
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {assistants.map((assistant) => {
            const isPinned = pinnedIds.has(assistant.id);
            return (
              <div
                key={assistant.id}
                className={`${styles.card} ${isPinned ? styles.cardPinned : ''}`}
                onClick={() => onEdit(assistant)}
              >
                {/* Hover Actions */}
                <div className={styles.cardActions}>
                  <button
                    className={styles.cardActionBtn}
                    title={isPinned ? '取消置顶' : '置顶到侧栏'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(assistant.id);
                    }}
                  >
                    {isPinned ? '📌' : '📍'}
                  </button>
                  <button
                    className={styles.cardActionBtn}
                    title="删除"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(assistant.id);
                    }}
                  >
                    🗑️
                  </button>
                </div>

                {/* Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardAvatar}>
                    {assistant.emoji || '🍵'}
                  </div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardNameRow}>
                      <span className={styles.cardName}>{assistant.name}</span>
                      {isPinned && (
                        <span className={styles.cardPinIcon}>📌</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className={styles.cardDesc}>
                  {assistant.description ||
                    assistant.systemPrompt ||
                    t('agent.assistant.no_prompt', '未设置提示词')}
                </div>

                {/* Meta */}
                <div className={styles.cardMeta}>
                  <span className={styles.cardMetaTag}>
                    上下文: {formatContextWindow(assistant.contextWindow)}
                  </span>
                  {assistant.modelId && (
                    <>
                      <span className={styles.cardMetaDot} />
                      <span className={styles.cardMetaTag}>
                        ✨ {assistant.modelId}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Card */}
          <div className={styles.addCard} onClick={onCreate}>
            <span className={styles.addIcon}>＋</span>
            <span className={styles.addText}>
              {t('agent.assistant.create_new', '创建新伙伴')}
            </span>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTargetId !== null && (
        <div
          className={styles.dialogOverlay}
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            className={styles.dialogBox}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogTitle}>
              {t('agent.assistant.delete_confirm_title', '确认删除？')}
            </div>
            <div className={styles.dialogText}>
              {t(
                'agent.assistant.delete_confirm_content',
                '删除此伙伴后，关联的所有会话也将被删除，此操作无法撤销。',
              )}
            </div>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.dialogBtn} ${styles.dialogBtnCancel}`}
                onClick={() => setDeleteTargetId(null)}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                className={`${styles.dialogBtn} ${styles.dialogBtnDanger}`}
                onClick={handleConfirmDelete}
              >
                {t('common.delete', '删除')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
