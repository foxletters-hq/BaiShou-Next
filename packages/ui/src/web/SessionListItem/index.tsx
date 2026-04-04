import React from 'react';
import styles from './SessionListItem.module.css';
import { useTranslation } from 'react-i18next';
import { Pin, PinOff, Edit3, Trash2, Bot } from 'lucide-react';

export interface SessionData {
  id: string;
  title?: string;
  isPinned?: boolean;
  updatedAt?: number; 
  snippet?: string; 
  avatar?: string | React.ReactNode; 
}

export interface SessionListItemProps {
  session: SessionData;
  isSelected: boolean;
  isMultiSelect?: boolean;
  isChecked?: boolean;
  onTap: () => void;
  onPin?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onCheckChanged?: (checked: boolean) => void;
}

export const SessionListItem: React.FC<SessionListItemProps> = ({
  session,
  isSelected,
  isMultiSelect = false,
  isChecked = false,
  onTap,
  onPin,
  onRename,
  onDelete,
  onCheckChanged,
}) => {
  const { t } = useTranslation();
  const displayTitle = session.title || t('agent.sessions.new_chat', '新的对话');
  const fallbackSnippet = t('agent.sessions.empty_history', '暂无聊天记录...');
  
  // A simple relative time formatter fallback
  const formatTime = (ts?: number) => {
  if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('common.justNow', '刚刚');
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return new Date(ts).toLocaleDateString();
  };

  const handleAction = (e: React.MouseEvent, action?: () => void) => {


    e.stopPropagation();
    if (action) action();
  };

  return (
    <div className={styles.itemWrapper}>
      <div 
        className={`${styles.container} ${isSelected ? styles.selected : ''}`}
        onClick={onTap}
      >
         <div className={styles.headerRow}>
            <div className={styles.titleArea}>
               {isMultiSelect && (
                 <input 
                   type="checkbox" 
                   className={styles.checkbox}
                   checked={isChecked}
                   onChange={(e) => onCheckChanged?.(e.target.checked)}
                   onClick={(e) => e.stopPropagation()}
                 />
               )}
               {session.isPinned && (
                 <span className={styles.pinIcon} title={t('chat.pinned', '已固定')}><Pin size={12} fill="currentColor"/></span>
               )}
               <span className={`${styles.title} ${isSelected ? styles.titleSelected : ''}`}>
                 {displayTitle}
               </span>
            </div>
            {session.updatedAt && (
              <span className={styles.timeLabel}>{formatTime(session.updatedAt)}</span>
            )}
         </div>

         <div className={styles.bodyRow}>
            <div className={styles.avatarBox}>
               {typeof session.avatar === 'string' && session.avatar.startsWith('http') ? (
                 <img src={session.avatar} alt="Agent" className={styles.avatarImg} />
               ) : session.avatar ? (
                 session.avatar
               ) : (
                 <Bot size={14} />
               )}
            </div>
            <span className={styles.snippet}>
               {session.snippet || fallbackSnippet}
            </span>
         </div>

         {/* Hover Actions (Replacing clunky menus) */}
         <div className={styles.actionsBox}>
            {onPin && (
              <button 
                className={styles.actionBtn} 
                onClick={(e) => handleAction(e, onPin)}
                title={session.isPinned ? t('agent.sessions.unpin', '取消置顶') : t('agent.sessions.pin', '置顶会话')}
              >
                {session.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            )}
            {onRename && (
              <button 
                className={styles.actionBtn} 
                onClick={(e) => handleAction(e, onRename)}
                title={t('agent.sessions.rename', '重命名')}
              >
                <Edit3 size={14} />
              </button>
            )}
            {onDelete && (
              <button 
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`} 
                onClick={(e) => handleAction(e, onDelete)}
                title={t('common.delete', '删除')}
              >
                <Trash2 size={14} />
              </button>
            )}
         </div>

      </div>
    </div>
  );
};
