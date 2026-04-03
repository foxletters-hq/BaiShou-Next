import React, { useEffect, useRef } from 'react';
import { Terminal, Zap } from 'lucide-react';
import styles from './PromptShortcutSheet.module.css';
import { useTranslation } from 'react-i18next';


export interface PromptShortcut {
  id: string;
  command: string; // 例如 "translate" (不包含斜杠)
  description: string;
  tag?: string;
  content: string; // 实际替换进来的文本
}

export interface PromptShortcutSheetProps {
  isOpen: boolean;
  shortcuts: PromptShortcut[];
  selectedIndex: number; // 由父组件控制键盘上下键以决定哪个被高亮
  onSelect: (shortcut: PromptShortcut) => void;
}

export const PromptShortcutSheet: React.FC<PromptShortcutSheetProps> = ({
  isOpen,
  shortcuts,
  selectedIndex,
  onSelect
}) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);

  // 当选择的索引改变时，确保将其滚动入视野
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
       <div className={styles.header}>
          <Zap size={14} /> {t('shortcut.title', '快捷控制指令 (Shortcut)')}
       </div>
       <div className={styles.listArea} ref={listRef}>
          {shortcuts.map((shortcut, index) => (
             <div 
               key={shortcut.id}
               className={`${styles.item} ${index === selectedIndex ? styles.itemSelected : ''}`}
               onClick={() => onSelect(shortcut)}
             >
                <div className={styles.itemIcon}>
                   <Terminal size={14} />
                </div>
                <div className={styles.itemInfo}>
                   <div className={styles.titleRow}>
                      <span className={styles.command}>/{shortcut.command}</span>
                      {shortcut.tag && <span className={styles.tag}>{shortcut.tag}</span>}
                   </div>
                   <div className={styles.desc}>{shortcut.description}</div>
                </div>
             </div>
          ))}
          {shortcuts.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('shortcut.no_match', '找不到任何匹配的快捷指令...')}
            </div>
          )}
       </div>
    </div>
  );
};
