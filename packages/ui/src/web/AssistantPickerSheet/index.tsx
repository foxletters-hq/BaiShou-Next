import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, X, Cpu, Database, Command, CheckSquare } from 'lucide-react';
import styles from './AssistantPickerSheet.module.css';

// 使用与管理页一致的核心 Contract
export interface AssistantInfo {
  id: string;
  name: string;
  emoji: string;
  description: string;
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

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.dialog}>
         
         {/* ─── 左侧机能筛选屏 ─── */}
         <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
               <Cpu size={24} className={styles.headerIcon} />
               <span className={styles.headerTitle}>{t('agent.selectAssistant', '热载心智')}</span>
            </div>

            <div className={styles.searchBox}>
               <Search size={16} color="var(--text-secondary)" />
               <input 
                 type="text"
                 placeholder={t('agent.searchP', '扫描标识...')}
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className={styles.searchInput}
               />
            </div>

            <div className={styles.listArea}>
               {filteredAssistants.length === 0 ? (
                 <div className={styles.emptyText}>{t('agent.noMatch', '信号隔离，未发现对应节点。')}</div>
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
               <button className={styles.createBtn} onClick={() => { if(onCreateNew) onCreateNew(); }}>
                  <Plus size={16} /> {t('agent.createNew', '编织全新连接')}
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
                  <Cpu size={48} opacity={0.3} />
                  <span>未捕捉到焦点，请在左侧指定心智实体。</span>
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
                        <Command size={16}/> 潜意识网 (Prompt)
                     </div>
                     <div 
                       className={`${styles.tab} ${activeTab === 'memory' ? styles.tabActive : ''}`}
                       onClick={() => setActiveTab('memory')}
                     >
                        <Database size={16}/> 神经簇状态 (RAG)
                     </div>
                  </div>

                  <div className={styles.tabContent}>
                     {activeTab === 'prompt' ? (
                        <>
                           <h3 className={styles.sectionTitle}>主被动心智指北</h3>
                           <div className={styles.promptBox}>
                              {activeAssistant.systemPrompt || '未编写核心控制参数，系统将进入空运行默认状态。'}
                           </div>
                        </>
                     ) : (
                        <>
                           <h3 className={styles.sectionTitle}>突触与模型连接报告</h3>
                           <div className={styles.metaGrid}>
                              <div className={styles.metaItem}>
                                 <span className={styles.metaLabel}>大模型供应商</span>
                                 <span className={styles.metaValue}>{activeAssistant.providerId || 'System Primary'}</span>
                              </div>
                              <div className={styles.metaItem}>
                                 <span className={styles.metaLabel}>算力集群</span>
                                 <span className={styles.metaValue}>{activeAssistant.modelId || 'Default Cluster'}</span>
                              </div>
                              <div className={styles.metaItem}>
                                 <span className={styles.metaLabel}>上下文轮跨度限制</span>
                                 <span className={styles.metaValue}>{activeAssistant.contextWindow < 0 ? 'Infinite 无限' : activeAssistant.contextWindow + ' 轮'}</span>
                              </div>
                              <div className={styles.metaItem}>
                                 <span className={styles.metaLabel}>向量挂载区 (RAG)</span>
                                 <span className={styles.metaValue}>{activeAssistant.ragSpaceId || '未锁定'}</span>
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
                          <CheckSquare size={18} /> 连接覆盖：启动 {activeAssistant.name}
                        </button>
                     ) : (
                        <button className={`${styles.applyBtn} ${styles.applyBtnCurrent}`} disabled>
                           该心智已处于热载执行期
                        </button>
                     )}
                  </div>
               </div>
            )}
         </div>

      </div>
    </>
  );
};
