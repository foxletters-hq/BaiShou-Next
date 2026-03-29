import React, { useState } from 'react';
import styles from './RecallBottomSheet.module.css';

export interface MemoryNode {
  id: string;
  content: string;
  relevanceScore: number;
  date: string;
}

interface RecallBottomSheetProps {
  topic?: string;
  results: MemoryNode[];
  onSearch: (query: string) => void;
  onInjectContext: (memoryIds: string[]) => void;
  onClose: () => void;
}

export const RecallBottomSheet: React.FC<RecallBottomSheetProps> = ({
  topic,
  results,
  onSearch,
  onInjectContext,
  onClose
}) => {
  const [query, setQuery] = useState(topic || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(query);
    }
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.handleBar} />
        
        <div className={styles.header}>
          <h2>记忆库召回</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.searchWrap}>
           <span className={styles.searchIcon}>✨</span>
           <input 
             type="text" 
             value={query}
             onChange={(e) => setQuery(e.target.value)}
             onKeyDown={handleSearch}
             placeholder="输入关键字检索相关上下文记忆 (Enter搜索)"
             className={styles.searchInput}
           />
        </div>

        <div className={styles.list}>
          {results.length === 0 ? (
            <div className={styles.empty}>未找到高相关度的记忆上下文</div>
          ) : (
            results.map(mem => (
               <div 
                 key={mem.id} 
                 className={`${styles.memoryCard} ${selectedIds.has(mem.id) ? styles.selected : ''}`}
                 onClick={() => toggleSelect(mem.id)}
               >
                  <div className={styles.cardHeader}>
                     <span className={styles.date}>{mem.date}</span>
                     <span className={styles.scoreBadge}>相近度 {(mem.relevanceScore * 100).toFixed(1)}%</span>
                  </div>
                  <div className={styles.cardContent}>
                     {mem.content}
                  </div>
                  {selectedIds.has(mem.id) && <div className={styles.checkbox}>✅</div>}
               </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
           <div className={styles.selectionInfo}>
              已选择 {selectedIds.size} 条记录
           </div>
           <button 
             className={styles.injectBtn} 
             onClick={() => onInjectContext(Array.from(selectedIds))}
             disabled={selectedIds.size === 0}
           >
              注入到当前对话
           </button>
        </div>
      </div>
    </>
  );
};
