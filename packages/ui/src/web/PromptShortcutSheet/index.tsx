import React, { useEffect, useRef } from 'react';
import { Terminal, Zap } from 'lucide-react';
import styles from './PromptShortcutSheet.module.css';
import { useTranslation } from 'react-i18next';


export interface PromptShortcut {
  id: string;
  icon?: string;
  name?: string;
  content: string;
  // Legacy / fallback fields
  command?: string;
  description?: string;
  tag?: string;
}

export interface PromptShortcutSheetProps {
  isOpen: boolean;
  shortcuts: PromptShortcut[];
  selectedIndex: number;
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

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  const getLocalizedShortcut = (shortcut: PromptShortcut) => {
    // Elegant internationalization and data mapping
    let cmd = shortcut.command;
    if (!cmd) {
       // Use name or tag instead of id for display
       cmd = shortcut.name || shortcut.tag || (shortcut.id.startsWith('default-') ? shortcut.id.replace('default-', '') : 'unnamed');
    }

    if (shortcut.id === 'default-translate') {
      return {
         ...shortcut,
         command: cmd,
         name: t('agent.tools.shortcuts.translate_name', shortcut.tag || '翻译助手'),
         content: t('agent.tools.shortcuts.translate_content', shortcut.content),
         icon: shortcut.icon || '🌐',
         description: shortcut.description || t('agent.tools.shortcuts.translate_content', shortcut.content)
      };
    }
    if (shortcut.id === 'default-summarize') {
      return {
         ...shortcut,
         command: cmd,
         name: t('agent.tools.shortcuts.summarize_name', shortcut.tag || '长文总结'),
         content: t('agent.tools.shortcuts.summarize_content', shortcut.content),
         icon: shortcut.icon || '📝',
         description: shortcut.description || t('agent.tools.shortcuts.summarize_content', shortcut.content)
      };
    }
    
    return {
      ...shortcut,
      command: cmd,
      name: shortcut.name || shortcut.tag || 'Prompt',
      icon: shortcut.icon,
      description: shortcut.description || shortcut.content
    };
  };

  return (
    <div className={styles.overlay}>
       <div className={styles.header}>
          <Zap size={14} /> {t('shortcut.title', '快捷控制指令 (Shortcut)')}
       </div>
       <div className={styles.listArea} ref={listRef}>
          {(shortcuts || []).map((rawShortcut, index) => {
             const shortcut = getLocalizedShortcut(rawShortcut);
             return (
               <div 
                 key={shortcut.id}
                 className={`${styles.item} ${index === selectedIndex ? styles.itemSelected : ''}`}
                 onClick={() => onSelect(rawShortcut)}
               >
                  <div className={styles.itemIcon}>
                     {shortcut.icon ? <span style={{ fontSize: 14 }}>{shortcut.icon}</span> : <Terminal size={14} />}
                  </div>
                  <div className={styles.itemInfo}>
                     <div className={styles.titleRow}>
                        <span className={styles.command}>/{shortcut.command}</span>
                        {shortcut.name && <span className={styles.tag}>{shortcut.name}</span>}
                     </div>
                     <div className={styles.desc}>{shortcut.description}</div>
                  </div>
               </div>
             );
          })}
           {shortcuts.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('shortcut.no_match', '找不到任何匹配的快捷指令...')}
            </div>
          )}
       </div>
    </div>
  );
};

export * from './ShortcutManagerDialog';
