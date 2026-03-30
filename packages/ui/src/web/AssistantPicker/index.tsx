import React, { useState, useMemo } from 'react';
import styles from './AssistantPicker.module.css';
import { MockAgentAssistant } from '@baishou/shared/src/mock/agent.mock';

interface AssistantPickerProps {
  isOpen: boolean;
  onClose: () => void;
  assistants: MockAgentAssistant[];
  currentAssistantId?: string | null;
  onSelect: (assistant: MockAgentAssistant) => void;
}

export const AssistantPicker: React.FC<AssistantPickerProps> = ({
  isOpen,
  onClose,
  assistants,
  currentAssistantId,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(currentAssistantId || null);
  const [activeTab, setActiveTab] = useState<'prompt'|'memory'>('prompt');
  
  const filteredAssistants = useMemo(() => {
    return assistants.filter(a => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assistants, searchQuery]);

  // Try to default select first if current not found or selectedId not in filtered
  const activeAssistant = useMemo(() => {
     let item = filteredAssistants.find(a => a.id === selectedId);
     if (!item && filteredAssistants.length > 0) {
       item = filteredAssistants[0];
     }
     return item;
  }, [filteredAssistants, selectedId]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
         {/* Left Sidebar */}
         <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
               <span className={styles.sidebarTitleIcon}>✨</span>
               <span className={styles.sidebarTitle}>选择伙伴</span>
            </div>

            <div className={styles.searchWrapper}>
               <span className={styles.searchIcon}>🔍</span>
               <input 
                 className={styles.searchInput}
                 placeholder="搜索..."
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
               />
            </div>

            <div className={styles.assistantList}>
               {filteredAssistants.length === 0 ? (
                 <div className={styles.emptyHint}>没有相关伙伴</div>
               ) : (
                 filteredAssistants.map(a => {
                    const isSelected = activeAssistant?.id === a.id;
                    const isCurrent = a.id === currentAssistantId;
                    return (
                      <div 
                        key={a.id}
                        className={`${styles.sidebarItem} ${isSelected ? styles.sidebarItemSelected : ''}`}
                        onClick={() => setSelectedId(a.id)}
                      >
                         <div className={styles.sidebarItemAvatar}>
                            {a.emoji || '✨'}
                         </div>
                         <div className={styles.sidebarItemInfo}>
                            <div className={styles.sidebarItemNameRow}>
                               <span className={styles.sidebarItemName}>{a.name}</span>
                               {isCurrent && <span className={styles.currentDot}></span>}
                            </div>
                            <span className={styles.sidebarItemDesc}>{a.description}</span>
                         </div>
                      </div>
                    );
                 })
               )}
            </div>

            <div className={styles.createBtnWrapper}>
               <button className={styles.createBtn}>
                  <span className={styles.createBtnIcon}>+</span>
                  <span className={styles.createBtnLabel}>新建伙伴</span>
               </button>
            </div>
         </div>

         {/* Right Detail Panel */}
         <div className={styles.detailPanel}>
            {activeAssistant ? (
              <>
                 <div className={styles.detailHeader}>
                    <div className={styles.detailAvatar}>{activeAssistant.emoji || '✨'}</div>
                    <div className={styles.detailInfo}>
                       <div className={styles.detailNameRow}>
                          <span className={styles.detailName}>{activeAssistant.name}</span>
                          {activeAssistant.id === currentAssistantId && (
                            <span className={styles.detailCurrentTag}>当前</span>
                          )}
                       </div>
                       <span className={styles.detailDesc}>{activeAssistant.description}</span>
                    </div>
                 </div>

                 <div className={styles.tabsWrapper}>
                    <div 
                      className={`${styles.tabItem} ${activeTab === 'prompt' ? styles.tabSelected : ''}`}
                      onClick={() => setActiveTab('prompt')}
                    >
                      提示词
                    </div>
                    <div 
                      className={`${styles.tabItem} ${activeTab === 'memory' ? styles.tabSelected : ''}`}
                      onClick={() => setActiveTab('memory')}
                    >
                      记忆
                    </div>
                 </div>

                 <div className={styles.tabContentArea}>
                    {activeTab === 'prompt' ? (
                       <div className={styles.tabPanelPrompt}>
                         <h4 className={styles.panelTitle}>系统提示词</h4>
                         <textarea 
                           className={styles.systemPromptInput} 
                           defaultValue={activeAssistant.systemPrompt}
                         />
                         
                         <h4 className={styles.panelTitle}>模型设置</h4>
                         <div className={styles.modelSettingBox}>
                            <span>Provider: {activeAssistant.providerId}</span>
                            <span>Model: {activeAssistant.modelId}</span>
                         </div>
                       </div>
                    ) : (
                       <div className={styles.tabPanelMemory}>
                         <h4 className={styles.panelTitle}>上下文窗口管理</h4>
                         <div className={styles.settingRow}>
                            <span>上下文携带 Window:</span>
                            <span>{activeAssistant.contextWindow} tokens</span>
                         </div>
                         <div className={styles.settingRow}>
                            <span>启用上下文压缩:</span>
                            <span>{activeAssistant.compressTokenThreshold > 0 ? `阈值 ${activeAssistant.compressTokenThreshold}` : '关闭'}</span>
                         </div>
                       </div>
                    )}
                 </div>

                 <div className={styles.detailFooter}>
                    <button 
                      className={`${styles.selectBtn} ${activeAssistant.id === currentAssistantId ? styles.selectBtnCurrent : ''}`}
                      onClick={() => {
                        onSelect(activeAssistant);
                        onClose();
                      }}
                    >
                       {activeAssistant.id === currentAssistantId ? (
                         <>
                           <span className={styles.btnIcon}>✅</span>
                           当前伙伴
                         </>
                       ) : (
                         <>
                           <span className={styles.btnIcon}>⇄</span>
                           选择此伙伴
                         </>
                       )}
                    </button>
                 </div>
              </>
            ) : (
              <div className={styles.emptyDetail}>
                 <span className={styles.emptyDetailIcon}>✨</span>
                 <span className={styles.emptyDetailText}>选择一个伙伴查看详情</span>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};
