import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(shortcuts.length / pageSize));
  const paginatedShortcuts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return shortcuts.slice(start, start + pageSize);
  }, [shortcuts, currentPage, pageSize]);

  // 切换页码时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [shortcuts.length]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector(`.${styles.itemSelected}`) as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, isOpen, currentPage]);

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

  const showPagination = shortcuts.length > 5;
  const startIdx = (currentPage - 1) * pageSize;

  return (
    <div className={styles.overlay}>
       <div className={styles.header}>
          <Zap size={14} /> {t('shortcut.title', '快捷控制指令 (Shortcut)')}
       </div>
       <div className={styles.listArea} ref={listRef}>
          {paginatedShortcuts.map((rawShortcut, i) => {
             const globalIndex = startIdx + i;
             const shortcut = getLocalizedShortcut(rawShortcut);
             return (
               <div 
                 key={shortcut.id}
                 className={`${styles.item} ${globalIndex === selectedIndex ? styles.itemSelected : ''}`}
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
       {showPagination && (
         <div className={styles.paginationBar}>
           <select
             className={styles.pageSizeSelect}
             value={pageSize}
             onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
           >
             {[5, 10, 15, 20, 25, 30].map(size => (
               <option key={size} value={size}>{size}</option>
             ))}
           </select>
           <button
             className={styles.pageBtn}
             disabled={currentPage <= 1}
             onClick={() => setCurrentPage(p => p - 1)}
           >
             &lsaquo;
           </button>
           <span className={styles.pageCurrent}>{currentPage}/{totalPages}</span>
           <button
             className={styles.pageBtn}
             disabled={currentPage >= totalPages}
             onClick={() => setCurrentPage(p => p + 1)}
           >
             &rsaquo;
           </button>
         </div>
       )}
    </div>
  );
};

export * from './ShortcutManagerDialog';
