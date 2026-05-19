import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, BookHeart, Check, ArrowUpCircle, BookOpen, Loader2, Copy, BrainCircuit } from 'lucide-react';
import styles from './RecallDialog.module.css';
import { DashboardSharedMemoryCard } from '../DashboardSharedMemoryCard/DashboardSharedMemoryCard';
import { toast } from '../Toast/useToast';

export interface RecallItem {
  id: string;
  type: 'diary' | 'memory';
  title: string;
  snippet: string;
  date: string;
  similarity?: number;
}

export interface RecallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: RecallItem[];
  isSearching?: boolean;
  onSearch: (query: string, tab: 'diary' | 'memory', mode?: 'semantic' | 'text') => void;
  onInject: (selectedItems: RecallItem[]) => void;
  searchMode?: 'semantic' | 'text';
  onToggleSearchMode?: () => void;
  lookbackMonths?: number;
  onMonthsChanged?: (val: number) => void;
  onCopyContext?: () => void;
}

export const RecallDialog: React.FC<RecallDialogProps> = ({
  isOpen,
  onClose,
  items,
  isSearching,
  onInject,
  onSearch,
  searchMode = 'semantic',
  onToggleSearchMode,
  lookbackMonths = 1,
  onMonthsChanged,
  onCopyContext
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'diary' | 'memory'>('diary');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 向量回忆 tab 的搜索：带 debounce，传递 searchMode
  useEffect(() => {
    if (!isOpen || activeTab !== 'memory') return undefined;
    const timeoutId = setTimeout(() => {
      onSearch(searchQuery, 'memory', searchMode);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchMode, activeTab, isOpen]);

  // 日记档案 tab 切换时触发一次搜索
  useEffect(() => {
    if (!isOpen || activeTab !== 'diary') return undefined;
    onSearch('', 'diary');
    return undefined;
  }, [activeTab, isOpen]);

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
    setSelectedIds(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.dialog} onClick={e => e.stopPropagation()}>
           
           <div className={styles.header}>
              <span className={styles.headerTitle}>
                 <BookOpen size={20} className={styles.headerIcon} />
                 {t('recall.title_new', '唤醒回忆')}
              </span>
              <button className={styles.closeBtn} onClick={onClose}>
                 <X size={16} strokeWidth={3} />
              </button>
           </div>

           <div className={styles.toolbar}>
              <div className={styles.tabs}>
                 <div 
                   className={`${styles.tab} ${activeTab === 'diary' ? styles.tabActive : ''}`}
                   onClick={() => { setActiveTab('diary'); setSelectedIds(new Set()); setSearchQuery(''); }}
                 >
                    {t('recall.tab_diary', '日记档案')}
                 </div>
                 <div 
                   className={`${styles.tab} ${activeTab === 'memory' ? styles.tabActive : ''}`}
                   onClick={() => { setActiveTab('memory'); setSelectedIds(new Set()); setSearchQuery(''); }}
                 >
                    {t('recall.tab_memory', '向量记忆')}
                 </div>
              </div>
           </div>

           {/* 向量回忆 tab：RAG 风格搜索框 */}
           {activeTab === 'memory' && (
             <div className={styles.ragSearchBar}>
               <div className={styles.ragSearchInner}>
                 <Search size={18} className={styles.ragSearchIcon} />
                 <input
                   type="text"
                   placeholder={searchMode === 'semantic' ? t('recall.search_semantic_hint', '语义搜索记忆内容...') : t('recall.search_text_hint', '关键词搜索记忆内容...')}
                   className={styles.ragSearchInput}
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                 />
                 <div className={styles.segmentedControl}>
                   <button 
                     type="button"
                     className={`${styles.segmentBtn} ${searchMode === 'semantic' ? styles.segmentBtnActive : ''}`}
                     onClick={() => searchMode !== 'semantic' && onToggleSearchMode?.()}
                   >
                     {t('recall.search_semantic', '语义搜索')}
                   </button>
                   <button 
                     type="button"
                     className={`${styles.segmentBtn} ${searchMode === 'text' ? styles.segmentBtnActive : ''}`}
                     onClick={() => searchMode !== 'text' && onToggleSearchMode?.()}
                   >
                     {t('recall.search_text', '文本搜索')}
                   </button>
                 </div>
                 {searchQuery && (
                   <div className={styles.ragSearchClear} onClick={() => setSearchQuery('')}>
                     <X size={16} />
                   </div>
                 )}
               </div>
             </div>
           )}

           <div className={styles.listArea}>
             {/* 日记档案 tab：复用共同回忆统计框 */}
             {activeTab === 'diary' ? (
               <div className={styles.sharedMemoryWrap}>
                 {onCopyContext && onMonthsChanged && (
                   <DashboardSharedMemoryCard
                     lookbackMonths={lookbackMonths}
                     onMonthsChanged={onMonthsChanged}
                     onCopyContext={onCopyContext}
                   />
                 )}
                 {/* 日记档案搜索结果 */}
                 {isSearching ? (
                   <div className={styles.emptyState}>
                     <Loader2 className={styles.spinner} size={24} />
                     {t('common.loading', '加载中...')}
                   </div>
                 ) : items.length > 0 ? (
                   items.map(item => {
                     return (
                       <div 
                         key={item.id} 
                         className={`${styles.card} ${styles.diaryCard}`}
                         onClick={async () => {
                           try {
                             await navigator.clipboard.writeText(item.snippet);
                             toast.showSuccess(t('recall.copy_success', '已复制记忆到剪贴板！'));
                           } catch (err) {
                             toast.showError(t('common.copy_failed', '复制失败'));
                           }
                         }}
                       >
                          <div className={styles.cardInfo}>
                             <div className={styles.cardHeader}>
                                <span className={styles.cardTitle}>
                                   <BookHeart size={16} className={styles.diaryIcon} />
                                   {item.title}
                                </span>
                                <div className={styles.cardHeaderRight}>
                                   <span className={styles.cardDate}>{item.date}</span>
                                   <button 
                                     className={styles.copyBtn}
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       navigator.clipboard.writeText(item.snippet);
                                       toast.showSuccess(t('recall.copy_success', '已复制记忆到剪贴板！'));
                                     }}
                                     title={t('common.copy', '复制')}
                                   >
                                     <Copy size={14} />
                                   </button>
                                </div>
                             </div>
                             <div className={styles.cardSnippet}>{item.snippet}</div>
                          </div>
                       </div>
                     );
                   })
                 ) : null}
               </div>
             ) : (
               /* 向量回忆 tab：搜索结果 */
               isSearching ? (
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
                                  <BrainCircuit size={16} className={styles.memoryIcon} />
                                  {item.title}
                               </span>
                               <div className={styles.cardHeaderRight}>
                                  {searchMode === 'semantic' && item.similarity !== undefined && (
                                    <span className={`${styles.similarityBadge} ${
                                      item.similarity >= 0.85 
                                        ? styles.similarityHigh 
                                        : item.similarity >= 0.7 
                                          ? styles.similarityMed 
                                          : styles.similarityLow
                                    }`}>
                                      {t('recall.match_score', '匹配度 {{score}}%', { score: (item.similarity * 100).toFixed(1) })}
                                    </span>
                                  )}
                                  <span className={styles.cardDate}>{item.date}</span>
                               </div>
                            </div>
                            <div className={styles.cardSnippet}>{item.snippet}</div>
                         </div>
                      </div>
                    )
                 })
               )
             )}
           </div>

           {activeTab === 'memory' && (
             <div className={styles.footer}>
                <div className={styles.selectionCount}>
                   {t('recall.selected', '已选择')} <span className={styles.countBadge}>{selectedIds.size}</span>
                </div>
                <button 
                  className={styles.injectBtn} 
                  disabled={selectedIds.size === 0}
                  onClick={handleInject}
                >
                   <ArrowUpCircle size={16} />
                   {t('recall.inject', '提取至当前上下文对话')}
                </button>
             </div>
           )}
        </div>
      </div>
    </>
  );
}
