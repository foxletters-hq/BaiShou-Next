import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, X, Star, Database, Command, CheckSquare, Cpu, Trash2, History, Minimize2, Edit2 } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { MilkdownEditorWrapper } from '../DiaryEditor/MilkdownEditor';
import { ModelSwitcherPopup } from '../ModelSwitcherPopup';
import { useDialog } from '../Dialog';
import { AvatarEditor } from '../AvatarEditor';
import styles from './AssistantPickerSheet.module.css';

// 使用与管理页一致的核心 Contract
export interface AssistantInfo {
  id: string;
  name: string;
  emoji: string;
  avatarPath?: string;
  description?: string;
  systemPrompt: string;
  contextWindow: number;
  providerId?: string;
  modelId?: string;
  compressTokenThreshold: number;
  compressKeepTurns?: number;
  ragSpaceId?: string; // B1.9 针对 Memory 表需要特化显示
}

export interface AssistantPickerSheetProps {
  isOpen: boolean;
  assistants: AssistantInfo[];
  currentAssistantId?: string;
  onSelect: (assistant: AssistantInfo) => void;
  onClose: () => void;
  onCreateNew?: () => void;
  onRefreshAssistants?: () => void; // 用于主动通知外部重新拉取数据
}

export const AssistantPickerSheet: React.FC<AssistantPickerSheetProps> = ({
  isOpen,
  assistants,
  currentAssistantId,
  onSelect,
  onClose,
  onCreateNew,
  onRefreshAssistants
}) => {
  const { t } = useTranslation();
  const { prompt } = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  // 保持当前系统使用的助手在一打开时即为 selected 状态以供查看，或首个助手。
  const [selectedId, setSelectedId] = useState<string | null>(
     currentAssistantId || (assistants.length > 0 ? assistants[0].id : null)
  );
  const [activeTab, setActiveTab] = useState<'prompt' | 'memory'>('prompt');
  
  // 临时编辑状态
  const [editingPrompt, setEditingPrompt] = useState('');
  const [editingContextWindow, setEditingContextWindow] = useState(-1);
  const [editingCompressEnabled, setEditingCompressEnabled] = useState(true);
  const [editingCompressThreshold, setEditingCompressThreshold] = useState(60000);
  const [editingCompressKeepTurns, setEditingCompressKeepTurns] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 当外部 currentAssistantId 传入或变化时（如打开新面板），重新对齐焦点
  React.useEffect(() => {
  if (isOpen && currentAssistantId) {
       setSelectedId(currentAssistantId);
    }
  }, [isOpen, currentAssistantId]);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
       (window as any).api.settings.getProviders().then((res: any) => {
          if (res) setProviders(res);
       });
    }
  }, []);

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

  // 当活动伙伴切换时，同步本地编辑状态
  React.useEffect(() => {
     if (activeAssistant) {
        setEditingPrompt(activeAssistant.systemPrompt || '');
        setEditingContextWindow(activeAssistant.contextWindow ?? -1);
        setEditingCompressEnabled(activeAssistant.compressTokenThreshold > 0);
        setEditingCompressThreshold(activeAssistant.compressTokenThreshold > 0 ? activeAssistant.compressTokenThreshold : 60000);
        setEditingCompressKeepTurns(activeAssistant.compressKeepTurns ?? 3);
     }
  }, [activeAssistant]);

  const saveConfig = async (overrides: Partial<any> = {}) => {
     if (!activeAssistant) return;
     try {
        setIsSaving(true);
        if (typeof window !== 'undefined' && (window as any).electron) {
           await (window as any).electron.ipcRenderer.invoke('agent:update-assistant', activeAssistant.id, {
              systemPrompt: overrides.systemPrompt !== undefined ? overrides.systemPrompt : editingPrompt.trim(),
              contextWindow: overrides.contextWindow !== undefined ? overrides.contextWindow : editingContextWindow,
              compressTokenThreshold: overrides.compressTokenThreshold !== undefined ? overrides.compressTokenThreshold : (editingCompressEnabled ? editingCompressThreshold : 0),
              compressKeepTurns: overrides.compressKeepTurns !== undefined ? overrides.compressKeepTurns : editingCompressKeepTurns,
              ...overrides
           });
        }
        if (onRefreshAssistants) { 
           onRefreshAssistants();
        }
     } finally {
        setIsSaving(false);
     }
  };

  const updateAssistantAPI = async (id: string, updates: any) => {
      if (typeof window !== 'undefined' && (window as any).electron) {
         await (window as any).electron.ipcRenderer.invoke('agent:update-assistant', id, updates);
         if (onRefreshAssistants) onRefreshAssistants();
      }
  };

  const handleEditName = async () => {
     if (!activeAssistant) return;
     const newName = await prompt("请输入新的伙伴名称：", activeAssistant.name, "修改伙伴名称", false);
     if (newName && newName.trim()) {
        updateAssistantAPI(activeAssistant.id, { name: newName.trim() });
     }
  };

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
                       <div className={styles.itemAvatar}>
                         {ast.avatarPath ? <img src={ast.avatarPath} alt="avatar" style={{width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover'}} /> : (ast.emoji ? ast.emoji : <Cpu size={18} color="var(--color-primary)" />)}
                       </div>
                       <div className={styles.itemInfo}>
                          <div className={styles.itemNameRow}>
                             <span className={styles.itemName}>{ast.name}</span>
                             {isCurrent && <span className={styles.currentBadge}>{t('agent.assistant.current', '当前')}</span>}
                          </div>
                          <div className={styles.itemDesc}>{ast.description}</div>
                       </div>
                       {assistants.length > 1 && (
                          <div 
                            className={styles.deleteBtnWrapper}
                            onClick={(e) => {
                               e.stopPropagation();
                               setDeleteTargetId(ast.id);
                            }}
                          >
                             <Trash2 size={14} />
                          </div>
                       )}
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
                     <AvatarEditor 
                        emoji={activeAssistant.emoji} 
                        avatarPath={activeAssistant.avatarPath}
                        onChange={(type, value) => {
                           if (type === 'emoji') {
                               updateAssistantAPI(activeAssistant.id, { emoji: value, avatarPath: '' });
                           } else {
                               updateAssistantAPI(activeAssistant.id, { avatarPath: value });
                           }
                        }}
                     >
                        <div className={styles.detailAvatar} title={t('common.edit_avatar', '点击修改头像')}>
                           {activeAssistant.avatarPath ? (
                              <img src={activeAssistant.avatarPath} style={{width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover'}} />
                           ) : activeAssistant.emoji}
                        </div>
                     </AvatarEditor>
                     <div className={styles.detailTitles}>
                        <h2 onClick={handleEditName} title="点击修改名称" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                           {activeAssistant.name} <Edit2 size={16} color="var(--text-secondary)" />
                        </h2>
                        <p>{activeAssistant.description}</p>
                     </div>
                  </div>

                  {/* 状态控制 Tab */}
                  <div className={styles.tabsRow} style={{ justifyContent: 'center', gap: 48 }}>
                     <div 
                       className={`${styles.tab} ${activeTab === 'prompt' ? styles.tabActive : ''}`}
                       onClick={() => setActiveTab('prompt')}
                     >
                         {t('agent.assistant.prompt_label', '提示词')}
                      </div>
                      <div 
                        className={`${styles.tab} ${activeTab === 'memory' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('memory')}
                      >
                         {t('agent.assistant.memory_label', '记忆')}
                      </div>
                  </div>

                  <div className={styles.tabContent}>
                     {activeTab === 'prompt' ? (
                        <>
                           <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                              <Command size={18} color="var(--color-primary)" />
                              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>{t('agent.assistant.prompt_label', '系统提示词')}</h3>
                           </div>
                           <div 
                              style={{ width: '100%', height: 180, border: '1px solid rgba(var(--color-outline-variant-rgb, 200, 200, 200), 0.3)', borderRadius: 12, outline: 'none', background: 'transparent', overflowY: 'auto' }}
                              onBlur={(e) => {
                                 if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                     saveConfig();
                                 }
                              }}
                           >
                              <MilkdownEditorWrapper
                                 content={editingPrompt}
                                 onChange={(val: string) => setEditingPrompt(val || '')}
                                 placeholder={t('agent.assistant.prompt_hint', '定义伙伴的角色、行为和回复风格...')}
                              />
                           </div>
                           
                           <div style={{ display: 'flex', alignItems: 'center', marginTop: 24, marginBottom: 8, gap: 8 }}>
                              <Star size={18} color="var(--color-primary)" />
                              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>{t('agent.assistant.bind_model_label', '绑定模型')}</h3>
                           </div>
                           <div 
                              className={styles.modelSelectorArea}
                              onClick={() => setShowModelSwitcher(true)}
                              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 12, border: '1px solid rgba(var(--color-outline-variant-rgb, 200, 200, 200), 0.3)', background: 'var(--bg-surface-highlight, rgba(248, 250, 252, 0.2))', padding: '14px 16px', gap: 12 }}
                           >
                              <Command size={18} color="var(--color-primary)" />
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                 {activeAssistant.providerId ? (
                                    <>
                                       <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{activeAssistant.providerId}</span>
                                       <span style={{ fontSize: 13, fontWeight: 'bold' }}>{activeAssistant.modelId}</span>
                                    </>
                                 ) : (
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('agent.assistant.use_global_model', '使用全局模型')}</span>
                                 )}
                              </div>
                              {activeAssistant.providerId && <X size={16} color="var(--text-secondary)" onClick={(e) => { e.stopPropagation(); updateAssistantAPI(activeAssistant.id, { providerId: null, modelId: null }); }} style={{ cursor: 'pointer' }} />}
                           </div>
                        </>
                     ) : (
                        <>
                           <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                              <History size={16} color="var(--color-primary)" />
                              <h3 className={styles.sectionTitle} style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t('agent.assistant.context_window_label', '上下文窗口')}</h3>
                           </div>
                           
                           {/* Context Window */}
                           <div style={{ padding: 14, border: '1px solid rgba(var(--color-outline-variant-rgb, 200,200,200), 0.2)', borderRadius: 12, marginBottom: 20, background: 'var(--bg-surface-highlight, rgba(248, 250, 252, 0.2))' }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: editingContextWindow >= 0 ? 12 : 0 }}>
                                 <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>窗口大小</span>
                                 <div style={{ flex: 1 }}></div>
                                 {editingContextWindow >= 0 && (
                                   <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-primary)', marginRight: 4 }}>
                                     {editingContextWindow}
                                   </span>
                                 )}
                                 <span style={{ fontSize: 13, marginRight: 8, color: 'var(--text-primary)' }}>
                                   {editingContextWindow < 0 ? t('agent.assistant.context_unlimited', '无限制') : t('agent.assistant.context_limited', '轮转')}
                                 </span>
                                 <label className={styles.toggleSwitch}>
                                   <input type="checkbox" checked={editingContextWindow < 0} onChange={(e) => {
                                      const newVal = e.target.checked ? -1 : 20;
                                      setEditingContextWindow(newVal);
                                      saveConfig({ contextWindow: newVal });
                                   }} />
                                   <span className={styles.toggleSlider}></span>
                                 </label>
                              </div>
                              {editingContextWindow >= 0 && (
                                 <input
                                   type="range"
                                   className={styles.sliderInput}
                                   min={2} max={100} step={1}
                                   value={editingContextWindow}
                                   onChange={(e) => setEditingContextWindow(Number(e.target.value))}
                                   onMouseUp={() => saveConfig()}
                                   onTouchEnd={() => saveConfig()}
                                 />
                              )}
                           </div>

                           {/* Auto Compression */}
                           <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                              <Minimize2 size={16} color="var(--color-primary)" />
                              <h3 className={styles.sectionTitle} style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t('agent.assistant.compress_label', '自动压缩')}</h3>
                           </div>
                           <div style={{ padding: 14, border: '1px solid rgba(var(--color-outline-variant-rgb, 200,200,200), 0.2)', borderRadius: 12, background: 'var(--bg-surface-highlight, rgba(248, 250, 252, 0.2))' }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: editingCompressEnabled ? 12 : 0 }}>
                                 <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>状态</span>
                                 <div style={{ flex: 1 }}></div>
                                 {editingCompressEnabled && (
                                   <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-primary)', marginRight: 8 }}>
                                     {(editingCompressThreshold >= 10000 ? (editingCompressThreshold / 10000).toFixed(editingCompressThreshold % 10000 === 0 ? 0 : 1) + 'w' : editingCompressThreshold)}
                                   </span>
                                 )}
                                 <label className={styles.toggleSwitch}>
                                   <input type="checkbox" checked={editingCompressEnabled} onChange={(e) => {
                                      const val = e.target.checked;
                                      setEditingCompressEnabled(val);
                                      if (val && editingCompressThreshold <= 0) {
                                         setEditingCompressThreshold(60000);
                                         saveConfig({ compressTokenThreshold: 60000 });
                                      } else {
                                         saveConfig({ compressTokenThreshold: val ? editingCompressThreshold : 0 });
                                      }
                                   }} />
                                   <span className={styles.toggleSlider}></span>
                                 </label>
                              </div>
                              {editingCompressEnabled && (
                                 <>
                                   <input
                                     type="range"
                                     className={styles.sliderInput}
                                     min={10000} max={1000000} step={10000}
                                     value={editingCompressThreshold}
                                     onChange={(e) => setEditingCompressThreshold(Number(e.target.value))}
                                     onMouseUp={() => saveConfig()}
                                     onTouchEnd={() => saveConfig()}
                                   />
                                   <div style={{ width: '100%', height: 1, background: 'rgba(200,200,200,0.15)', margin: '16px 0' }}></div>
                                   <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                                      <span style={{ fontSize: 13, color: 'var(--text-secondary)'}}>
                                        {t('agent.assistant.compress_keep_turns_label', '保留最后交互轮数')}
                                      </span>
                                      <div style={{ flex: 1 }}></div>
                                      <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                        {t('agent.assistant.compress_keep_turns_unit', '{{count}} 轮', { count: editingCompressKeepTurns }).replace('$count', String(editingCompressKeepTurns))}
                                      </span>
                                   </div>
                                   <input
                                      type="range"
                                      className={styles.sliderInput}
                                      min={1} max={10} step={1}
                                      value={editingCompressKeepTurns}
                                      onChange={(e) => setEditingCompressKeepTurns(Number(e.target.value))}
                                      onMouseUp={() => saveConfig()}
                                      onTouchEnd={() => saveConfig()}
                                    />
                                 </>
                              )}
                           </div>
                        </>
                     )}
                  </div>

                  <div className={styles.actionRow}>
                     <button 
                         className={`${styles.applyBtn} ${activeAssistant.id === currentAssistantId ? styles.applyBtnCurrent : ''}`}
                         disabled={activeAssistant.id === currentAssistantId}
                         onClick={() => {
                            onSelect(activeAssistant);
                            onClose();
                         }}
                     >
                        <CheckSquare size={18} /> {activeAssistant.id === currentAssistantId ? t('agent.assistant.current_partner', '当前伙伴') : t('agent.chat.select_partner', '选择伙伴')}
                     </button>
                  </div>
               </div>
            )}
         </div>

      </div>

      {showModelSwitcher && (
        <ModelSwitcherPopup 
          onClose={() => setShowModelSwitcher(false)}
          providers={providers.map(p => ({
            id: p.id || p.providerId,
            name: p.name || p.providerId || p.id,
            type: p.type || 'custom',
            models: p.models || [],
            enabledModels: p.enabledModels || []
          }))}
          currentProviderId={activeAssistant?.providerId}
          currentModelId={activeAssistant?.modelId}
          onSelect={(pid, mid) => {
            if (activeAssistant) {
               updateAssistantAPI(activeAssistant.id, { providerId: pid, modelId: mid });
            }
            setShowModelSwitcher(false);
          }}
        />
      )}

      {deleteTargetId !== null && (
        <div
          style={{
             position: 'fixed', inset: 0, zIndex: 100000, 
             display: 'flex', alignItems: 'center', justifyContent: 'center', 
             backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)'
          }}
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            style={{
               width: '360px', background: 'var(--bg-surface, #fff)', 
               borderRadius: '16px', overflow: 'hidden',
               boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
               display: 'flex', flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '32px 24px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20
              }}>
                <Trash2 size={32} color="#ef4444" />
              </div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('agent.assistant.delete_confirm', '是否确认删除该伙伴？')}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                此操作将永久删除该伙伴的所有配置，该操作不可恢复。
              </p>
            </div>
            <div style={{ 
               display: 'flex', padding: '16px 24px', gap: '12px', 
               background: 'var(--bg-surface-highlight, #f8fafc)', 
               borderTop: '1px solid rgba(148,163,184,0.1)' 
            }}>
              <button
                style={{
                   flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                   background: 'transparent', color: 'var(--text-secondary)', fontSize: '15px',
                   fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s'
                }}
                onClick={() => setDeleteTargetId(null)}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                style={{
                   flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                   background: '#ef4444', color: '#fff', fontSize: '15px',
                   fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s',
                   boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
                onClick={async () => {
                   if (typeof window !== 'undefined' && (window as any).electron) {
                      await (window as any).electron.ipcRenderer.invoke('agent:delete-assistant', deleteTargetId);
                      if (onRefreshAssistants) onRefreshAssistants();
                      const isCurrent = deleteTargetId === currentAssistantId;
                      const isSelected = deleteTargetId === selectedId;
                      if (isCurrent && onClose) onClose();
                      if (isSelected && assistants.length > 0) {
                         setSelectedId(assistants.find(a => a.id !== deleteTargetId)?.id || null);
                      }
                   }
                   setDeleteTargetId(null);
                }}
              >
                {t('common.confirm_delete', '确认删除')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
