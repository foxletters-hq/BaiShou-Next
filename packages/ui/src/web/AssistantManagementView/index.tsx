import React from 'react';
import styles from './AssistantManagementView.module.css';
import { useTranslation } from 'react-i18next';
import { MdAdd, MdDragIndicator, MdPushPin, MdOutlinePushPin, MdDeleteOutline, MdAutoAwesome } from 'react-icons/md';

export interface AgentAssistant {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  avatarPath?: string | null;
  emoji?: string | null;
  contextWindow: number;
  modelId?: string | null;
}

export interface AssistantManagementViewProps {
  assistants: AgentAssistant[];
  pinnedIds: string[];
  onCreate: () => void;
  onEdit: (assistant: AgentAssistant) => void;
  onTogglePin: (assistantId: string) => void;
  onDelete: (assistant: AgentAssistant) => void;
  onReorder?: (oldIndex: number, newIndex: number) => void;
}

export const AssistantManagementView: React.FC<AssistantManagementViewProps> = ({
  assistants,
  pinnedIds,
  onCreate,
  onEdit,
  onTogglePin,
  onDelete,
  onReorder
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('agent.assistant.management_title', '伙伴管理')}</h2>
        <button className={styles.createBtn} onClick={onCreate}>
          <MdAdd size={20} />
          {t('agent.assistant.create', '新建伙伴')}
        </button>
      </div>

      {assistants.length === 0 ? (
        <div className={styles.emptyState}>
          <MdAutoAwesome className={styles.emptyIcon} />
          <div className={styles.emptyText}>{t('agent.assistant.empty_hint', '您还没有创建任何专属伙伴')}</div>
          <button className={styles.createBtn} onClick={onCreate}>
            {t('agent.assistant.create_first', '创建第一个')}
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {assistants.map((assistant) => {
            const isPinned = pinnedIds.includes(assistant.id);

            return (
              <div 
                key={assistant.id} 
                className={styles.card}
                onClick={() => onEdit(assistant)}
              >
                <div 
                  className={styles.dragHandle} 
                  onPointerDown={(e) => { e.stopPropagation(); /* drag logic */ }}
                >
                  <MdDragIndicator size={20} />
                </div>

                <div className={styles.avatar}>
                  {assistant.avatarPath ? (
                    <img src={`secure-file://${assistant.avatarPath}`} alt={assistant.name} className={styles.avatarImg} />
                  ) : (
                    assistant.emoji || '🍵'
                  )}
                </div>

                <div className={styles.contentRow}>
                  <div className={styles.nameRow}>
                    <span className={styles.nameText}>{assistant.name}</span>
                  </div>
                  <div className={styles.descText}>
                    {assistant.description || assistant.systemPrompt || t('agent.assistant.no_prompt', '暂无系统提示词')}
                  </div>
                  <div className={styles.metaRow}>
                    <span>{t('agent.assistant.context_window_label', '上下文窗口')}: {assistant.contextWindow}</span>
                    {assistant.modelId && (
                      <>
                        <span style={{ margin: '0 8px' }}>•</span>
                        <MdAutoAwesome size={12} style={{ marginRight: 4 }} />
                        <span>{assistant.modelId}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.actions} onClick={e => e.stopPropagation()}>
                  <button 
                    className={`${styles.actionBtn} ${isPinned ? styles.active : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(assistant.id);
                    }}
                    title={isPinned ? t('agent.assistant.unpin_from_sidebar', '取消停靠侧栏') : t('agent.assistant.pin_to_sidebar', '固定到侧栏')}
                  >
                    {isPinned ? <MdPushPin size={20} /> : <MdOutlinePushPin size={20} />}
                  </button>
                  <button 
                    className={styles.actionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(t('agent.assistant.delete_confirm_content', '您确认要删除吗？该操作不可逆转！'))) {
                        onDelete(assistant);
                      }
                    }}
                    title={t('common.delete', '删除')}
                    style={{ color: '#ef4444' }}
                  >
                    <MdDeleteOutline size={20} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
