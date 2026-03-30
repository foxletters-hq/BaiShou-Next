import React, { useState } from 'react';
import styles from './SessionListItem.module.css';

// TODO: [Agent1-Dependency] i18n
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => {
    const dict: Record<string, string> = {
      'agent.sessions.new_chat': '新对话',
      'agent.sessions.actions': '操作',
      'agent.sessions.pin': '置顶',
      'agent.sessions.unpin': '取消置顶',
      'agent.sessions.rename': '重命名',
      'agent.sessions.delete_session': '删除会话',
    };
    return dict[key] || key;
  },
});

export interface SessionData {
  id: string;
  title: string;
  isPinned: boolean;
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
  const [menuOpen, setMenuOpen] = useState(false);

  const displayTitle = session.title || t('agent.sessions.new_chat');

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleAction = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (action) action();
  };

  return (
    <div className={styles.itemWrapper}>
      <div 
        className={`${styles.container} ${isSelected ? styles.selected : ''}`}
        onClick={onTap}
      >
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
           <span className={styles.pinIcon}>📌</span>
         )}

         <span className={`${styles.title} ${isSelected ? styles.titleSelected : ''}`}>
           {displayTitle}
         </span>

         {isSelected && (
           <div className={styles.actionsBox}>
              <button 
                className={styles.moreBtn} 
                onClick={handleMenuClick}
                title={t('agent.sessions.actions')}
              >
                ⋮
              </button>

              {menuOpen && (
                <>
                  <div className={styles.menuOverlay} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                  <div className={styles.dropdownMenu}>
                    <div className={styles.menuItem} onClick={(e) => handleAction(e, onPin)}>
                       <span className={styles.menuIcon}>{session.isPinned ? '📌' : '📍'}</span>
                       {session.isPinned ? t('agent.sessions.unpin') : t('agent.sessions.pin')}
                    </div>
                    <div className={styles.menuItem} onClick={(e) => handleAction(e, onRename)}>
                       <span className={styles.menuIcon}>✏️</span>
                       {t('agent.sessions.rename')}
                    </div>
                    <div className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={(e) => handleAction(e, onDelete)}>
                       <span className={styles.menuIcon}>🗑️</span>
                       {t('agent.sessions.delete_session')}
                    </div>
                  </div>
                </>
              )}
           </div>
         )}
      </div>
    </div>
  );
};
