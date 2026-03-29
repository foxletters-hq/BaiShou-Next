import React from 'react';
import styles from './PromptShortcutSheet.module.css';

export interface PromptShortcut {
  id: string;
  trigger: string;
  command: string;
  description: string;
}

interface PromptShortcutSheetProps {
  shortcuts: PromptShortcut[];
  onSelect: (command: string) => void;
  onClose: () => void;
}

export const PromptShortcutSheet: React.FC<PromptShortcutSheetProps> = ({
  shortcuts,
  onSelect,
  onClose
}) => {
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.handleBar} />
        
        <div className={styles.header}>
          <h2>快捷指令</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.list}>
          {shortcuts.length === 0 ? (
            <div className={styles.empty}>暂无自定义指令</div>
          ) : (
            shortcuts.map(sc => (
               <div 
                 key={sc.id} 
                 className={styles.shortcutItem}
                 onClick={() => onSelect(sc.command)}
               >
                  <div className={styles.triggerBadge}>/{sc.trigger}</div>
                  <div className={styles.commandContent}>
                     <span className={styles.description}>{sc.description}</span>
                     <span className={styles.commandPreview}>{sc.command}</span>
                  </div>
               </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
