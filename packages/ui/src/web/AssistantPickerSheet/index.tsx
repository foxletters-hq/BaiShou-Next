import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, X, Star, Database, Command, CheckSquare } from 'lucide-react';
import styles from './AssistantPickerSheet.module.css';

// 使用与管理页一致的核心 Contract
export interface AssistantInfo {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  systemPrompt: string;
  contextWindow: number;
  providerId?: string;
  modelId?: string;
  compressTokenThreshold: number;
  ragSpaceId?: string; // B1.9 针对 Memory 表需要特化显示
}

export interface AssistantPickerSheetProps {
  isOpen: boolean;
  assistants: AssistantInfo[];
  currentAssistantId?: string;
  onSelect: (assistant: AssistantInfo) => void;
  onClose: () => void;
  onCreateNew?: () => void;
}

export const AssistantPickerSheet: React.FC<AssistantPickerSheetProps> = ({
  isOpen,
  assistants,
  currentAssistantId,
  onSelect,
  onClose,
  onCreateNew
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  // 保持当前系统使用的助手在一打开时即为 selected 状态以供查看，或首个助手。
  const [selectedId, setSelectedId] = useState<string | null>(
     currentAssistantId || (assistants.length > 0 ? assistants[0].id : null)
  );
  const [activeTab, setActiveTab] = useState<'prompt' | 'memory'>('prompt');

  // 当外部 currentAssistantId 传入或变化时（如打开新面板），重新对齐焦点
  React.useEffect(() => {
  if (isOpen && currentAssistantId) {
       setSelectedId(currentAssistantId);
    }
  }, [isOpen, currentAssistantId]);

  const filteredAssistants = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();
    if (!q) return assistants;
    return assistants.filter(a => 
      a.name.toLowerCase().includes(q) || 
      (a.description && a.description.toLowerCase().includes(q))
    );
  }, [assistants, searchQuery]);

  const activeAssistant = useMemo(() => {
  let item = filteredAssistants.find(a => a.id === selectedId);
     if (!item && filteredAssistants.length > 0) {
        item = filteredAssistants[0]; // 退避选择搜索结果第一项
     }
     return item;
  }, [filteredAssistants, selectedId]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
         
         {/* ─── 左侧机能筛选屏 ─── */}
         <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
               <Star size={24} className={styles.headerIcon} />
               <span className={styles.headerTitle}>{t('assistant.select_title', '选择伙伴')}</span>
            </div>

            <div className={styles.searchBox}>
               <Search size={16} color="var(--text-secondary)" />
               <input 
                 type="text"
                 placeholder={t('common.search_hint', '搜索...')}
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className={styles.searchInput}
               />
            </div>

            <div className={styles.listArea}>
               {filteredAssistants.length === 0 ? (
                 <div className={styles.emptyText}>{t('assistant.no_assistant', '无伙伴')}</div>
               ) : (
                 filteredAssistants.map(ast => {
  const isSelected = activeAssistant?.id === ast.id;
                   const isCurrent = ast.id === currentAssistantId;

                   return (
                     <div 
                       key={ast.id} 
                       onClick={() => setSelectedId(ast.id)}
                       className={`${styles.listItem} ${isSelected ? styles.selectedItem : ''}`}
                     >
                       <div className={styles.itemAvatar}>{ast.emoji}</div>
                       <div className={styles.itemInfo}>
                          <div className={styles.itemNameRow}>
                             <span className={styles.itemName}>{ast.name}</span>
                             {isCurrent && <span className={styles.currentBadge}>IN USE</span>}
                          </div>
                          <div className={styles.itemDesc}>{ast.description}</div>
                       </div>
                     </div>
                   );
                 })
               )}
            </div>

            <div className={styles.bottomArea}>
               <button className={styles.createBtn} onClick={() => {
  if(onCreateNew) onCreateNew(); }}>
                  <Plus size={16} /> {t('assistant.create_title', '创建伙伴')}
               </button>
            </div>
         </div>

         {/* ─── 右侧属性审析屏 ─── */}
         <div className={styles.detailPane}>
            <button className={styles.closeBtn} onClick={onClose}>
               <X size={16} strokeWidth={3} />
            </button>
            
            {!activeAssistant ? (
               <div className={styles.emptyDetail}>
                  <Star size={48} opacity={0.3} />
                  <span>{t('assistant.picker_no_selection', '选择一个伙伴查看详情')}</span>
               </div>
            ) : (
               <div className={styles.detailContent}>
                  <div className={styles.detailHeader}>
                     <div className={styles.detailAvatar}>{activeAssistant.emoji}</div>
                     <div className={styles.detailTitles}>
                        <h2>{activeAssistant.name}</h2>
                        <p>{activeAssistant.description}</p>
                     </div>
                  </div>

                  {/* 状态控制 Tab */}
                  <div className={styles.tabsRow}>
                     <div 
                       className={`${styles.tab} ${activeTab === 'prompt' ? styles.tabActive : ''}`}
                       onClick={() => setActiveTab('prompt')}
                     >
                         <Command size={16}/> {t('assistant.prompt_label', '系统提示词')}
                      </div>
                      <div 
                        className={`${styles.tab} ${activeTab === 'memory' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('memory')}
                      >
                         <Database size={16}/> {t('rag.title', '语义搜索库 (RAG)')}
                      </div>
                  </div>

                  <div className={styles.tabContent}>
                     {activeTab === 'prompt' ? (
                        <>
                           <h3 className={styles.sectionTitle}>{t('assistant.picker_core_setting', '核心设定概要')}</h3>
                           <div className={styles.promptBox}>
                              {activeAssistant.systemPrompt || t('assistant.picker_no_prompt', '未编写系统提示词，助手将使用默认的通用回答模型设定。')}
                           </div>
                        </>
                     ) : (
                        <>
                           <h3 className={styles.sectionTitle}>{t('assistant.picker_connection_report', '模型接入情况')}</h3>
                           <div className={styles.metaGrid}>
                              <div className={styles.metaItem}>
                                 <span className={styles.metaLabel}>{t('assistant.provider', '模型供应商')}</span>
                                 <span className={styles.metaValue}>{activeAssistant.providerId || 'System Primary'}</span>
                              </div>
                              <div className={styles.metaItem}>
                                 <span className={styles.metaLabel}>{t('assistant.compute_cluster', '计算模型配置')}</span>
                                 <span className={styles.metaValue}>{activeAssistant.modelId || 'Default Cluster'}</span>
                              </div>
                              <div className={styles.metaItem}>
                                 <span className={styles.metaLabel}>{t('assistant.context_limit_title', '追溯对话限制')}</span>
                                 <span className={styles.metaValue}>{activeAssistant.contextWindow < 0 ? t('common.infinite', 'Infinite / 无限') : activeAssistant.contextWindow + ' 轮'}</span>
                              </div>
                              <div className={styles.metaItem}>
                                 <span className={styles.metaLabel}>{t('assistant.rag_mount', '关联的 RAG 知识库')}</span>
                                 <span className={styles.metaValue}>{activeAssistant.ragSpaceId || t('common.unbound', '未关联检索范围')}</span>
                              </div>
                           </div>
                        </>
                     )}
                  </div>

                  <div className={styles.actionRow}>
                     {activeAssistant.id !== currentAssistantId ? (
                        <button 
                          className={styles.applyBtn} 
                          onClick={() => {
                             onSelect(activeAssistant);
                             onClose();
                          }}
                        >
                           <CheckSquare size={18} /> {t('agent.chat.select_partner', '选择伙伴')}
                         </button>
                      ) : (
                         <button className={`${styles.applyBtn} ${styles.applyBtnCurrent}`} disabled>
                            {t('assistant.picker_already_active', '当前已选择此伙伴')}
                         </button>
                     )}
                  </div>
               </div>
            )}
         </div>

      </div>
    </div>,
    document.body
  );
};
