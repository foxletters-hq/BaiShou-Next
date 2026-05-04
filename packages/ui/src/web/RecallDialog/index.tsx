import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, BookHeart, BrainCircuit, Check, ArrowUpCircle, History, Loader2 } from 'lucide-react';
import styles from './RecallDialog.module.css';

export interface RecallItem {
  id: string;
  type: 'diary' | 'memory';
  title: string;
  snippet: string;
  date: string;
}

export interface RecallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: RecallItem[]; // 检索结果池
  isSearching?: boolean;
  onSearch: (query: string, tab: 'diary' | 'memory') => void;
  onInject: (selectedItems: RecallItem[]) => void;
}

export const RecallDialog: React.FC<RecallDialogProps> = ({
  isOpen,
  onClose,
  items,
  isSearching,
  onInject,
  onSearch
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'diary' | 'memory'>('diary');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Debounce 触发外部搜索
  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = setTimeout(() => {
      onSearch(searchQuery, activeTab);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab, isOpen]);

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
         {/* 模态弹窗 */}
        <div className={styles.dialog} onClick={e => e.stopPropagation()}>
           
           <div className={styles.header}>
              <span className={styles.headerTitle}>
                 <History size={22} className={styles.headerIcon} />
                 {t('recall.title', '上下文补充与唤醒')}
              </span>
              <button className={styles.closeBtn} onClick={onClose}>
                 <X size={16} strokeWidth={3} />
              </button>
           </div>

           <div className={styles.toolbar}>
              <div className={styles.tabs}>
                 <div 
                   className={`${styles.tab} ${activeTab === 'diary' ? styles.tabActive : ''}`}
                   onClick={() => { setActiveTab('diary'); setSelectedIds(new Set()); }}
                 >
                    {t('recall.tab_diary', '日记档案')}
                 </div>
                 <div 
                   className={`${styles.tab} ${activeTab === 'memory' ? styles.tabActive : ''}`}
                   onClick={() => { setActiveTab('memory'); setSelectedIds(new Set()); }}
                 >
                    {t('recall.tab_memory', '向量知识')}
                 </div>
              </div>
              <div className={styles.searchBox}>
                 <Search size={16} color="var(--text-secondary)" />
                 <input 
                   placeholder={t('recall.search_hint', '检索关键字或记忆片段...')} 
                   className={styles.searchInput}
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                 />
              </div>
           </div>

           <div className={styles.listArea}>
              {isSearching ? (
                 <div className={styles.emptyState}>
                    <Loader2 className={styles.spinner} size={24} />
                    {t('common.loading', '加载中...')}
                 </div>
              ) : items.length === 0 ? (
                 <div className={styles.emptyState}>{t('recall.no_results', '未在库中匹配到任何历史记忆碎片。')}</div>
              ) : (
                 items.map(item => {
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
                 {t('recall.selected', '已选择')} <span className={styles.countBadge}>{selectedIds.size}</span>
              </div>
              <button 
                className={styles.injectBtn} 
                disabled={selectedIds.size === 0}
                onClick={handleInject}
              >
                 <ArrowUpCircle size={18} />
                 {t('recall.inject', '提取至当前上下文对话')}
              </button>
           </div>
        </div>
      </div>
    </>
  );
}
