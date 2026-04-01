import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, BookHeart, BrainCircuit, Check, ArrowUpCircle, History } from 'lucide-react';
import styles from './RecallBottomSheet.module.css';

export interface RecallItem {
  id: string;
  type: 'diary' | 'memory';
  title: string;
  snippet: string;
  date: string;
}

export interface RecallBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: RecallItem[]; // 所有可能的记忆与日记池
  onInject: (selectedItems: RecallItem[]) => void;
}

export const RecallBottomSheet: React.FC<RecallBottomSheetProps> = ({
  isOpen,
  onClose,
  items,
  onInject
}) => {
  const { t: _t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'diary' | 'memory'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
     let res = items;
     if (activeTab !== 'all') {
        res = res.filter(i => i.type === activeTab);
     }
     if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        res = res.filter(i => i.title.toLowerCase().includes(q) || i.snippet.toLowerCase().includes(q));
     }
     return res;
  }, [items, activeTab, searchQuery]);

  const toggleSelect = (id: string) => {
     setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
     });
  };

  const handleInject = () => {
     const selected = items.filter(i => selectedIds.has(i.id));
     onInject(selected);
     setSelectedIds(new Set()); // 清空
     onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.sheet} onClick={e => e.stopPropagation()}>
           
           <div className={styles.handleContainer}>
              <div className={styles.handle} />
           </div>

           <div className={styles.header}>
              <span className={styles.headerTitle}>
                 <History size={22} className={styles.headerIcon} />
                 打捞散落上下文 (Context Recovery)
              </span>
              <button className={styles.closeBtn} onClick={onClose}>
                 <X size={16} strokeWidth={3} />
              </button>
           </div>

           <div className={styles.toolbar}>
              <div className={styles.tabs}>
                 <div 
                   className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
                   onClick={() => setActiveTab('all')}
                 >
                    全域检索
                 </div>
                 <div 
                   className={`${styles.tab} ${activeTab === 'diary' ? styles.tabActive : ''}`}
                   onClick={() => setActiveTab('diary')}
                 >
                    日记档案
                 </div>
                 <div 
                   className={`${styles.tab} ${activeTab === 'memory' ? styles.tabActive : ''}`}
                   onClick={() => setActiveTab('memory')}
                 >
                    向量记忆
                 </div>
              </div>
              <div className={styles.searchBox}>
                 <Search size={16} color="var(--text-secondary)" />
                 <input 
                   placeholder="扫描节点或记忆断签..." 
                   className={styles.searchInput}
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                 />
              </div>
           </div>

           <div className={styles.listArea}>
              {filteredItems.length === 0 ? (
                 <div className={styles.emptyState}>探针失效，未匹配到任何过去碎片。</div>
              ) : (
                 filteredItems.map(item => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <div 
                        key={item.id} 
                        className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                        onClick={() => toggleSelect(item.id)}
                      >
                         <div className={styles.checkboxWrap}>
                            {isSelected && <Check size={14} strokeWidth={4} />}
                         </div>
                         <div className={styles.cardInfo}>
                            <div className={styles.cardHeader}>
                               <span className={styles.cardTitle}>
                                  {item.type === 'diary' ? <BookHeart size={16} className={styles.diaryIcon} /> : <BrainCircuit size={16} className={styles.memoryIcon} />}
                                  {item.title}
                               </span>
                               <span className={styles.cardDate}>{item.date}</span>
                            </div>
                            <div className={styles.cardSnippet}>{item.snippet}</div>
                         </div>
                      </div>
                    )
                 })
              )}
           </div>

           <div className={styles.footer}>
              <div className={styles.selectionCount}>
                 已锁定数据块: <span className={styles.countBadge}>{selectedIds.size}</span>
              </div>
              <button 
                className={styles.injectBtn} 
                disabled={selectedIds.size === 0}
                onClick={handleInject}
              >
                 <ArrowUpCircle size={18} />
                 注入当前神经链接
              </button>
           </div>
        </div>
      </div>
    </>
  );
}
