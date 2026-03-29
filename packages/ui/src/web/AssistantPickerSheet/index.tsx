import React, { useState } from 'react';
import styles from './AssistantPickerSheet.module.css';

export interface AgentAssistant {
  id: string;
  name: string;
  description: string;
  avatarIcon: string;
  persona: string;
}

interface AssistantPickerSheetProps {
  assistants: AgentAssistant[];
  currentAssistantId?: string;
  onSelect: (assistant: AgentAssistant) => void;
  onClose: () => void;
  onCreateNew?: () => void;
}

export const AssistantPickerSheet: React.FC<AssistantPickerSheetProps> = ({
  assistants,
  currentAssistantId,
  onSelect,
  onClose,
  onCreateNew
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(currentAssistantId || (assistants.length > 0 ? assistants[0].id : null));

  const filtered = searchQuery.trim() === ''
    ? assistants
    : assistants.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.description.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeAssistant = assistants.find(a => a.id === selectedId);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.dialog}>
         {/* Left Sidebar */}
         <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
               <span className={styles.headerIcon}>✨</span>
               <span className={styles.headerTitle}>选择智能伙伴</span>
            </div>

            <div className={styles.searchBox}>
               <span className={styles.searchIcon}>🔍</span>
               <input 
                 type="text"
                 placeholder="搜索..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className={styles.searchInput}
               />
            </div>

            <div className={styles.listArea}>
               {filtered.length === 0 ? (
                 <div className={styles.emptyText}>没有匹配的伙伴</div>
               ) : (
                 filtered.map(ast => (
                   <div 
                     key={ast.id} 
                     onClick={() => setSelectedId(ast.id)}
                     className={`${styles.listItem} ${selectedId === ast.id ? styles.selectedItem : ''}`}
                   >
                     <div className={styles.itemAvatar}>{ast.avatarIcon}</div>
                     <div className={styles.itemInfo}>
                        <div className={styles.itemName}>
                           {ast.name}
                           {ast.id === currentAssistantId && <span className={styles.currentBadge}>当前</span>}
                        </div>
                        <div className={styles.itemDesc}>{ast.description}</div>
                     </div>
                   </div>
                 ))
               )}
            </div>

            <div className={styles.bottomArea}>
               <button className={styles.createBtn} onClick={onCreateNew}>
                  <span className={styles.addIcon}>+</span>新建伙伴
               </button>
            </div>
         </div>

         {/* Right Detail Pane */}
         <div className={styles.detailPane}>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
            
            {!activeAssistant ? (
               <div className={styles.emptyDetail}>选择一个伙伴查看详情</div>
            ) : (
               <div className={styles.detailContent}>
                  <div className={styles.detailHeader}>
                     <div className={styles.detailAvatar}>{activeAssistant.avatarIcon}</div>
                     <div className={styles.detailTitles}>
                        <h2>{activeAssistant.name}</h2>
                        <p>{activeAssistant.description}</p>
                     </div>
                  </div>

                  {/* Tabs simulation */}
                  <div className={styles.tabsRow}>
                     <div className={`${styles.tab} ${styles.tabActive}`}>Prompt (人设)</div>
                     <div className={styles.tab}>参数设置</div>
                  </div>

                  <div className={styles.tabContent}>
                     <h3 className={styles.sectionTitle}>系统提示词 (System Prompt)</h3>
                     <div className={styles.promptBox}>
                        {activeAssistant.persona}
                     </div>
                  </div>

                  <div className={styles.actionRow}>
                     {activeAssistant.id !== currentAssistantId && (
                        <button 
                          className={styles.applyBtn} 
                          onClick={() => onSelect(activeAssistant)}
                        >
                          切换到此伙伴
                        </button>
                     )}
                     <button className={styles.editBtn}>编辑属性</button>
                  </div>
               </div>
            )}
         </div>
      </div>
    </>
  );
};
