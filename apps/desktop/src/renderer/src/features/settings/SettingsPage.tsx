import React, { useState, useEffect } from 'react';
import { useSettingsStore, useUserProfileStore } from '@baishou/store';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdOutlineSettings, MdOutlineCloudQueue, MdOutlineStarBorder, MdSchool, MdColorLens, MdTravelExplore, MdOutlineExtension, MdOutlineAutoAwesome, MdOutlineWifiProtectedSetup, MdSync, MdOutlineFolderDelete, MdArrowBack } from 'react-icons/md';
import { TitleBar } from '../../components/TitleBar';
import './SettingsPage.css';
import { useTranslation } from 'react-i18next';
import baishouHeroImg from '../../assets/images/BaiShou-v0.0.1.jpeg';
import { 
  AppearanceSettingsCard, 
  DataManagementCard, 
  LanSyncCard, 
  CloudSyncPanel,
  ProfileSettingsCard,
  HotkeySettingsCard,
  WorkspaceSettingsCard,
  McpSettingsCard,
  StorageSettingsCard,
  AttachmentManagementView,
  AIModelServicesView,
  AIGlobalModelsView,
  AgentBehaviorSettingsCard,
  IdentitySettingsCard,
  RagMemoryView,
  AgentToolsView,
  WebSearchSettingsView,
  AboutSettingsCard,
  AssistantMatrixCard,
  SummarySettingsView,
  useDialog,
  useToast
} from '@baishou/ui';
import { AssistantManagementScreen } from '../agent/AssistantManagementScreen';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();

  const settings = useSettingsStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isClosing, setIsClosing] = useState(false);

  const TABS = [
    { id: 0, label: t('settings.general', '常规设置'), icon: <MdOutlineSettings /> },
    { type: 'divider' },
    { id: 1, label: t('settings.ai_services', '供应商管理'), icon: <MdOutlineCloudQueue /> },
    { id: 2, label: t('settings.ai_global_models', '全局默认模型'), icon: <MdOutlineStarBorder /> },
    { id: 3, label: t('agent.assistant.settings_entry', '伙伴管理'), icon: <MdSchool /> },
    { type: 'divider' },
    { id: 4, label: t('agent.rag.title', 'RAG 记忆管理'), icon: <MdColorLens /> },
    { id: 5, label: t('agent.tools.web_search', '网络搜索'), icon: <MdTravelExplore /> },
    { id: 6, label: t('settings.agent_tools_title', '工具管理'), icon: <MdOutlineExtension /> },
    { id: 7, label: t('settings.summary_settings_title', '回忆生成设置'), icon: <MdOutlineAutoAwesome /> },
    { type: 'divider' },
    { id: 8, label: t('settings.lan_transfer', '局域网传输'), icon: <MdOutlineWifiProtectedSetup /> },
    { id: 9, label: t('data_sync.title', '数据同步'), icon: <MdSync /> },
    { id: 10, label: t('settings.attachment_management', '附件管理'), icon: <MdOutlineFolderDelete /> },
  ];

  const location = useLocation();

  useEffect(() => {
  switch (location.pathname) {
      case '/settings/ai-services': setActiveTab(1); break;
      case '/settings/ai-models': setActiveTab(2); break;
      case '/settings/assistants': setActiveTab(3); break;
      case '/settings/rag': setActiveTab(4); break;
      case '/settings/web-search': setActiveTab(5); break;
      case '/settings/agent-tools': setActiveTab(6); break;
      case '/settings/summary': setActiveTab(7); break;
      case '/settings/lan-transfer': setActiveTab(8); break;
      case '/settings/data-sync': setActiveTab(9); break;
      case '/settings/attachments': setActiveTab(10); break;
      case '/settings':
      case '/settings/general':
      default:
        setActiveTab(0);
    }
  }, [location.pathname]);

  useEffect(() => {
  settings.loadConfig();
  }, [settings.loadConfig]);

  // Sync state to URL without pushing history excessively
  const handleTabChange = (tabId: number) => {
  setActiveTab(tabId);
    switch (tabId) {
      case 0: navigate('/settings/general', { replace: true }); break;
      case 1: navigate('/settings/ai-services', { replace: true }); break;
      case 2: navigate('/settings/ai-models', { replace: true }); break;
      case 3: navigate('/settings/assistants', { replace: true }); break;
      case 4: navigate('/settings/rag', { replace: true }); break;
      case 5: navigate('/settings/web-search', { replace: true }); break;
      case 6: navigate('/settings/agent-tools', { replace: true }); break;
      case 7: navigate('/settings/summary', { replace: true }); break;
      case 8: navigate('/settings/lan-transfer', { replace: true }); break;
      case 9: navigate('/settings/data-sync', { replace: true }); break;
      case 10: navigate('/settings/attachments', { replace: true }); break;
    }
  };

  const renderActiveView = () => {
  if (settings.isLoading) {
         return <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100, color: 'var(--color-on-surface-variant)' }}>{t('common.loading_settings', '读取配置表项状态中...')}</div>;
     }
     switch (activeTab) {
       case 0: return <GeneralSettingsView settings={settings} />;
       case 1: return <AiModelServicesPane settings={settings} />;
       case 2: return <AiGlobalModelsPane settings={settings} />;
       case 3: return <AssistantPane settings={settings} />;
       case 4: return <RagSettingsPane settings={settings} />;
       case 5: return <WebSearchPane settings={settings} />;
       case 6: return <AgentToolsPane settings={settings} />;
       case 7: return <SummarySettingsPane settings={settings} />;
       case 8: return <LanTransferPane />;
       case 9: return <DataSyncPane />;
       case 10: return <AttachmentManagementPane />;
       default: return <div />;
     }
  };

  const handleBack = () => {
    setIsClosing(true);
    setTimeout(() => {
      navigate(-1);
    }, 250); // Matches the exit animation duration
  };

  return (
    <div className={`settings-page-wrapper ${isClosing ? 'settings-closing' : ''}`}>
      <TitleBar />

      <div className="settings-layout-body">
        <div className="settings-sidebar">
           <div className="settings-header">
              <button className="settings-back-btn" onClick={handleBack} title={t('common.cancel', '取消')}>
                 <MdArrowBack />
              </button>
              <h1 className="settings-title">{t('settings.title', '系统设置')}</h1>
           </div>
           
           <div className="settings-nav-scroll">
              <div className="settings-nav-group">
              {TABS.map((tab, idx) => {
  if (tab.type === 'divider') {
                   return <div key={`div-${idx}`} className="settings-divider" />;
                }
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`settings-nav-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleTabChange(tab.id as number)}
                  >
                    <div className="settings-nav-icon">{tab.icon}</div>
                    <span className="settings-nav-label">{tab.label}</span>
                  </button>
                );
              })}
            </div>
         </div>
      </div>

      <div className="settings-content-area" style={{ position: 'relative' }}>
         {activeTab === 8 || activeTab === 1 || activeTab === 2 ? (
             renderActiveView()
         ) : (
             <div className="settings-content-scroll" key={activeTab}>
                {renderActiveView()}
             </div>
         )}
      </div>
      </div>
    </div>
  );
};

// --- Sub-Panes Implementation ---

const GeneralSettingsView: React.FC<{ settings: any }> = ({ settings }) => {
  const { t } = useTranslation();
  const { profile, loadProfile } = useUserProfileStore() as any;
  const [vaults, setVaults] = useState<any[]>([]);
  const [activeVault, setActiveVault] = useState<any>(null);
  
  const [storageStats, setStorageStats] = useState({ 
    storageRootPath: 'Loading...', 
    sqliteSizeStats: '0 MB', 
    vectorDbStats: '0 MB', 
    mediaCacheStats: '0 MB' 
  });

  useEffect(() => {
    if (loadProfile) loadProfile();
    const fetchVaults = async () => {
      try {
        const vList = await (window as any).api?.vault?.list();
        const active = await (window as any).api?.vault?.getActive();
        if (vList) setVaults(vList);
        if (active) setActiveVault(active);
      } catch (e) {}
    };
    
    const fetchStorage = async () => {
      try {
        if ((window as any).api?.storage) {
          const stats = await (window as any).api.storage.getStats();
          if (stats) setStorageStats(stats);
        }
      } catch (e) {}
    };

    fetchVaults();
    fetchStorage();
  }, [loadProfile]);

  return (
    <div className="settings-pane">
       
       <div className="glass-panel-card">
         <ProfileSettingsCard 
           profile={profile || { nickname: '', autoSync: false, avatarUrl: '' }}
           onSave={async (p) => {
             if (typeof window !== 'undefined' && window.electron) {
               await window.electron.ipcRenderer.invoke('profile:save', p);
               if (loadProfile) await loadProfile();
             }
           }}
         />
       </div>

       <div className="glass-panel-card">
         <IdentitySettingsCard 
           profile={profile || { nickname: '', avatarPath: '', activePersonaId: 'Default', personas: { 'Default': { id: 'Default', facts: {} } } }}
           onChange={async (newProfile) => {
             if (typeof window !== 'undefined' && window.electron) {
               await window.electron.ipcRenderer.invoke('profile:save', newProfile);
               if (loadProfile) await loadProfile();
             }
           }}
         />
       </div>

       <div className="glass-panel-card">
         <AppearanceSettingsCard 
           themeMode={settings.themeMode}
           seedColor={settings.themeColor || '#5BA8F5'}
           language={settings.locale}
           onThemeModeChange={settings.setThemeMode}
           onSeedColorChange={settings.setThemeColor}
           onLanguageChange={settings.setLocale}
         />
       </div>

       {settings.hotkeyConfig && (
          <div className="glass-panel-card">
            <HotkeySettingsCard 
               config={settings.hotkeyConfig}
               onChange={(config) => settings.setHotkeyConfig(config)}
            />
          </div>
       )}

       <div className="glass-panel-card">
         <McpSettingsCard 
           config={settings.mcpServerConfig || { mcpEnabled: false, mcpPort: 31004 }}
           onChange={settings.setMcpServerConfig}
         />
       </div>

       <div className="glass-panel-card">
         <WorkspaceSettingsCard 
            vaults={vaults.length > 0 ? vaults : [{ name: t('common.loading', 'Loading...'), path: '--' }]}
            activeVault={activeVault || vaults[0] || null}
            onSwitch={async (id) => await (window as any).api?.vault?.switchActive(id)}
            onDelete={async (id) => await (window as any).api?.vault?.delete(id)}
            onCreate={async () => await (window as any).api?.vault?.createDialog()}
         />
       </div>

       <div className="glass-panel-card">
         <StorageSettingsCard 
           storageRootPath={storageStats.storageRootPath}
           sqliteSizeStats={storageStats.sqliteSizeStats}
           vectorDbStats={storageStats.vectorDbStats}
           mediaCacheStats={storageStats.mediaCacheStats}
           onClearCache={async () => {
             await (window as any).api?.storage?.clearCache();
             if ((window as any).api?.storage) {
                const s = await (window as any).api.storage.getStats();
                if (s) setStorageStats(s);
             }
           }}
           onVacuumDb={async () => {
             await (window as any).api?.storage?.vacuumDb();
             if ((window as any).api?.storage) {
                const s = await (window as any).api.storage.getStats();
                if (s) setStorageStats(s);
             }
           }}
         />
       </div>

       <div className="glass-panel-card">
         <DataManagementCard 
           onExportZip={async () => {
              await (window as any).api?.archive?.exportZip();
           }}
           onImportZip={async () => {
              const file = await (window as any).api?.archive?.pickZip();
              if (file) {
                 await (window as any).api?.archive?.importZip(file);
              }
           }}
           onPickFile={async () => {
              return await (window as any).api?.archive?.pickZip();
           }}
           snapshots={[]}
         />
       </div>

       <div className="glass-panel-card">
         <AboutSettingsCard 
             version="v2.0.0-Next-Canary"
             heroImageSrc={baishouHeroImg}
             onOpenPrivacyPolicy={async () => await (window as any).api?.shell?.openExternal('https://github.com')}
             onOpenGithubHost={async () => await (window as any).api?.shell?.openExternal('https://github.com/Anson-Trio/BaiShou-Next/issues')}
         />
       </div>

    </div>
  );
};

const AiModelServicesPane: React.FC<{ settings: any }> = ({ settings }) => {
  const providerRecord = React.useMemo(() => {
    const rec: Record<string, any> = {};
    if (Array.isArray(settings.providers)) {
      settings.providers.forEach((p: any) => {
        rec[p.id] = {
          providerId: p.id,
          name: p.name,
          isSystem: p.isSystem,
          enabled: p.isEnabled,
          apiKey: p.apiKey,
          apiBaseUrl: p.baseUrl,
          models: p.models,
          enabledModels: p.enabledModels,
          sortOrder: p.sortOrder
        };
      });
    }
    return rec;
  }, [settings.providers]);

  return (
    <div style={{ height: '100%', display: 'flex', width: '100%' }}>
      <div style={{ height: '100%', display: 'flex', width: '100%' }}>
         <AIModelServicesView 
             providers={providerRecord}
             onUpdateProvider={(id, updates) => {
               const existing = (Array.isArray(settings.providers) ? settings.providers : []).find((p: any) => p.id === id) || { 
                 id: id, name: updates.name || id, type: 'custom', isSystem: false, sortOrder: 999
               };
               
               const newConfig = { ...existing };
               if (updates.name !== undefined) newConfig.name = updates.name;
               if (updates.isSystem !== undefined) newConfig.isSystem = updates.isSystem;
               if (updates.enabled !== undefined) newConfig.isEnabled = updates.enabled;
               if (updates.apiKey !== undefined) newConfig.apiKey = updates.apiKey;
               if (updates.apiBaseUrl !== undefined) newConfig.baseUrl = updates.apiBaseUrl;
               if (updates.models !== undefined) newConfig.models = updates.models;
               if (updates.enabledModels !== undefined) newConfig.enabledModels = updates.enabledModels;

               settings.updateProvider(newConfig);
             }}
             onDeleteProvider={(id) => {
               const filtered = (Array.isArray(settings.providers) ? settings.providers : []).filter((p: any) => p.id !== id);
               settings.setProviders(filtered);
             }}
             onReorderProviders={async (orderedIds) => {
               console.log('[Drag Tracking IPC] Received Reorder request in SettingsPage with ids:', orderedIds);
               try {
                 // The main process reads the full DB records and only updates sortOrder
                 // No stubs needed - this is fully handled server-side
                 console.log('[Drag Tracking IPC] Awaiting api.settings.reorderProviders IPC bridge...');
                 await (window as any).api?.settings?.reorderProviders(orderedIds);
                 console.log('[Drag Tracking IPC] IPC bridge completed successfully.');
                 
                 // Refresh local store state to reflect new sortOrder values
                 console.log('[Drag Tracking IPC] Awaiting api.settings.getProviders to pull refreshed state...');
                 const updated = await (window as any).api?.settings?.getProviders();
                 console.log('[Drag Tracking IPC] Fetched updated providers from DB:', updated);
                 
                 if (updated) {
                   settings.setProviders(updated);
                   console.log('[Drag Tracking IPC] Pushed refreshed sorted list into Zustand settings store.');
                 } else {
                   console.warn('[Drag Tracking IPC] getProviders returned null or undefined.');
                 }
               } catch (err) {
                 console.error('[Drag Tracking IPC] Failed to execute Reorder operation:', err);
               }
             }}
             onTestConnection={async (provId, tempKey, tempUrl, testModelId) => {
               await (window as any).api?.settings?.testProviderConnection(provId, tempKey, tempUrl, testModelId);
             }}
             onFetchModels={async (provId, tempKey, tempUrl) => {
               const models = await (window as any).api?.settings?.fetchProviderModels(provId, tempKey, tempUrl);
               return models || [];
             }}
         />
      </div>
    </div>
  );
};

const AiGlobalModelsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const providerRecord = React.useMemo(() => {
    const rec: Record<string, any> = {};
    if (Array.isArray(settings.providers)) {
      settings.providers.forEach((p: any) => {
        rec[p.id] = {
          providerId: p.id,
          enabled: p.isEnabled,
          apiKey: p.apiKey,
          apiBaseUrl: p.baseUrl,
          models: p.models,
          enabledModels: p.enabledModels
        };
      });
    }
    return rec;
  }, [settings.providers]);

  return (
    <div className="settings-pane settings-pane-full">
      {settings.globalModels && (
        <div style={{ height: '100%', display: 'flex', width: '100%' }}>
           <AIGlobalModelsView 
               config={settings.globalModels}
               availableProviders={providerRecord}
               onChange={(config) => settings.setGlobalModels(config)}
               onEmbeddingMigrationRequest={async () => true}
           />
        </div>
      )}
      {settings.agentBehaviorConfig && (
        <div className="glass-panel-card">
           <AgentBehaviorSettingsCard 
               config={settings.agentBehaviorConfig}
               onChange={(config) => settings.setAgentBehaviorConfig(config)}
           />
        </div>
      )}
    </div>
  );
};

const AssistantPane: React.FC<{ settings: any }> = ({ settings }) => {
  return (
    <div className="settings-pane settings-pane-full" style={{ padding: 0 }}>
      {settings.userProfileConfig && (
        <div className="glass-panel-card" style={{ margin: '16px 16px 0 16px' }}>
            <IdentitySettingsCard 
                profile={settings.userProfileConfig}
                onChange={(profile) => settings.setUserProfileConfig(profile)}
            />
        </div>
      )}
      <div style={{ flex: 1, position: 'relative' }}>
         <AssistantManagementScreen />
      </div>
    </div>
  );
};

const RagSettingsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [ragStats, setRagStats] = useState<any>({ totalCount: 0, currentDimension: 0, totalSizeText: '0 KB' });
  const [ragEntries, setRagEntries] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeRagState, setActiveRagState] = useState<any>({ isRunning: false, type: 'idle', progress: 0, total: 0, statusText: '' });
  const { confirm, prompt, alert } = useDialog();
  const toast = useToast();

  const fetchRagInfo = async () => {
    try {
      const s = await (window as any).api?.rag?.getStats();
      if (s) setRagStats(s);
      const e = await (window as any).api?.rag?.queryEntries({ limit: 50 });
      if (e) setRagEntries(e);
    } catch (err) {}
  };

  useEffect(() => {
    fetchRagInfo();
    let cleanup: any;
    if ((window as any).api?.rag?.onRagProgress) {
      cleanup = (window as any).api.rag.onRagProgress((state: any) => {
        setActiveRagState(state);
      });
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  if (!settings.ragConfig) return <div />;
  return (
    <div className="settings-pane settings-pane-full">
         <RagMemoryView 
             config={settings.ragConfig}
             stats={ragStats}
             ragState={activeRagState.isRunning ? activeRagState : { isRunning: isProcessing, type: 'idle', progress: 0, total: 0, statusText: '' }}
             hasMismatchModel={false}
             embeddingModelId={settings.globalModels?.globalEmbeddingModelId}
             entries={ragEntries}
             onChange={(config) => settings.setRagConfig(config)}
             onNavigateToConfig={() => navigate('/settings/ai-models')}
             onDetectDimension={async () => {
               setIsProcessing(true);
               try {
                 const detectedDim = await (window as any).api?.rag?.detectDimension();
                 await fetchRagInfo();
                 if (detectedDim > 0) {
                    toast.showSuccess(`检测完成，该模型向量维度为：${detectedDim}`);
                 } else {
                    await alert(t('ai_config.error_no_model', '检测失败：可能是未配置有效的 Embedding 模型或服务未连通。'), t('common.error', '错误'));
                 }
               } catch (e: any) {
                 await alert(`检测发生错误：${e.message}`, t('common.error', '错误'));
               } finally { setIsProcessing(false); }
             }}
             onClearDimension={async () => {
               if (!await confirm(t('settings.rag_clear_dimension', '清理当前维度数据') + '?', t('common.warning', '警告'))) return;
               setIsProcessing(true);
               try {
                 await (window as any).api?.rag?.clearDimension();
                 await fetchRagInfo();
               } finally { setIsProcessing(false); }
             }}
             onBatchEmbed={async () => {
               if (!await confirm(t('settings.rag_batch_embed', '全量扫描未索引日记') + '?', t('common.warning', '警告'))) return;
               setIsProcessing(true);
               try {
                 await (window as any).api?.rag?.triggerBatchEmbed();
                 await fetchRagInfo();
               } finally { setIsProcessing(false); }
             }}
             onAddManualMemory={async () => {
               const text = await prompt('', '', t('settings.rag_add_manual', '添加手动记忆片段'), true);
               if (!text || text.trim().length === 0) return;
               setIsProcessing(true);
               try {
                 await (window as any).api?.rag?.addManualMemory?.(text);
                 toast.showSuccess(t('common.success', '操作成功'));
                 await fetchRagInfo();
               } finally { setIsProcessing(false); }
             }}
             onTriggerMigration={async () => {
               if (!await confirm(t('settings.rag_trigger_migration', '执行向量库迁移') + '?', t('common.warning', '警告'))) return;
               setIsProcessing(true);
               try {
                 await (window as any).api?.rag?.triggerMigration();
                 await fetchRagInfo();
               } finally { setIsProcessing(false); }
             }}
             onClearAll={async () => {
               if (!await confirm(t('settings.rag_clear_all', '清空所有向量数据') + '?', t('common.dangerous_action', '危险操作'))) return;
               setIsProcessing(true);
               try {
                 await (window as any).api?.rag?.clearAll();
                 await fetchRagInfo();
               } finally { setIsProcessing(false); }
             }}
             onSearch={async (q) => {
               setIsProcessing(true);
               try {
                 const e = await (window as any).api?.rag?.queryEntries({ keyword: q, limit: 50 });
                 if (e) setRagEntries(e);
               } catch (err) {}
               finally { setIsProcessing(false); }
             }}
             onDeleteEntry={async (id) => {
               if (!await confirm(t('common.delete', '删除') + '?', t('common.warning', '警告'))) return;
               setIsProcessing(true);
               try {
                 await (window as any).api?.rag?.deleteEntry(id);
                 await fetchRagInfo();
               } finally { setIsProcessing(false); }
             }}
             onEditEntry={async (entry) => {
               const newText = await prompt(t('settings.rag_edit_prompt', '请修改下方的记忆片段内容：'), entry.text, t('settings.rag_edit_manual', '编辑记忆内容'), true);
               if (!newText || newText === entry.text) return;
               setIsProcessing(true);
               try {
                 await (window as any).api?.rag?.editEntry({ embeddingId: entry.embeddingId, newText: newText });
                 await fetchRagInfo();
               } catch (e: any) {
                 await alert(e.message, t('common.error', '错误'));
               } finally { setIsProcessing(false); }
             }}
         />
    </div>
  );
};

const WebSearchPane: React.FC<{ settings: any }> = ({ settings }) => {
  if (!settings.webSearchConfig) return <div />;
  return (
    <div className="settings-pane settings-pane-full">
         <WebSearchSettingsView 
             searchConfig={settings.webSearchConfig}
             onSearchChange={(config) => settings.setWebSearchConfig(config)}
         />
    </div>
  );
};

const AgentToolsPane: React.FC<{ settings: any }> = ({ settings }) => {
  if (!settings.toolManagementConfig) return <div />;
  return (
    <div className="settings-pane settings-pane-full">
         <AgentToolsView 
             config={settings.toolManagementConfig}
             onChange={(config) => settings.setToolManagementConfig(config)}
         />
    </div>
  );
};

const DEFAULT_SUMMARY_TEMPLATES = {
  weekly: `你是一个专业的个人传记作家伙伴。
**重要指令**：禁止输出任何问候语、开场白或结束语。直接输出纯 Markdown 内容。

### Markdown Template:
\`\`\`markdown
##### {year}年{month}月第{week}周总结

###### 📅 时间周期
- **日期范围**: {start} 至 {end}

###### 🎯 本周核心关键词
**关键词1**, **关键词2**, **关键词3**

---

###### 👥 核心人物与关系进展
- **(人物 1)**:
- **(人物 2)**:

---

###### 🎞️ 关键事件回顾 (Timeline)
- **【事件标题】**
    - **细节**:
    - **意义**:

---

###### 💡 思考与认知迭代
- **关于技术/工作**:
- **关于生活/自我**:

---

###### 📊 状态评估
- **身心能量**:
- **本周遗憾**:
- **下周展望**:

---
###### 🍵 给月度总结的"胶囊"
> (一句话概括)
\`\`\``,
  monthly: `你是一个专业的个人传记作家伙伴。
**重要指令**：禁止输出任何问候语、开场白或结束语。直接输出纯 Markdown 内容。

### Markdown Template:
\`\`\`markdown
##### {year}年{month}月度总结

###### 📅 日期范围
- **范围**: {start} 至 {end}

###### 🎯 本月核心主题
**主题1**, **主题2**

---

###### 📈 关键进展与成就
- **工作/技术**:
- **生活/个人**:

---

###### 👥 核心关系动态
- **(人物 1)**:
- **(人物 2)**:

---

###### 💡 深度思考

---

###### 📊 状态评估 (0-10)
- **状态**:
- **满意度**:

---
###### 🔮 下月展望
- **重点方向**:
\`\`\``,
  quarterly: `你是一个专业的个人传记作家伙伴。
**重要指令**：禁止输出任何问候语、开场白或结束语。直接输出纯 Markdown 内容。

### Markdown Template:
\`\`\`markdown
##### {year}年第{quarter}季度总结

###### 📅 日期范围
- **范围**: {start} 至 {end}

###### 🏆 季度里程碑
1. 
2. 

---

###### 🌊 关键趋势回顾
- **上升趋势**:
- **下降趋势**:

---

###### 👥 长期关系沉淀

---

###### 💡 季度复盘与洞察

---

###### 🧭 下季度战略重点
- **核心方向**:
\`\`\``,
  yearly: `你是一个专业的个人传记作家伙伴。
**重要指令**：禁止输出任何问候语、开场白或结束语。直接输出纯 Markdown 内容。

### Markdown Template:
\`\`\`markdown
# {year} 年度回顾：(用一个词定义这一年)

###### 📅 日期范围
- **范围**: {start} 至 {end}

---

###### 🌟 年度高光时刻
1. 
2. 

---

###### 🗺️ 生命轨迹回顾
- **Q1**:
- **Q2**:
- **Q3**:
- **Q4**:

---

###### 👥 年度重要关系

---

###### 🪴 认知觉醒

---

###### 💌 给未来的一封信
> 
\`\`\``
};

const SummarySettingsPane: React.FC<{ settings: any }> = ({ settings }) => {
  // If settings are not loaded yet, wait.
  if (settings.isLoading || !settings.summaryConfig || !settings.globalModels) return <div />;

  const combinedConfig = {
    monthlySummarySource: settings.globalModels.monthlySummarySource || 'weeklies',
    templates: settings.summaryConfig.instructions || {
        weekly: settings.summaryConfig.instructions?.weekly || DEFAULT_SUMMARY_TEMPLATES.weekly,
        monthly: settings.summaryConfig.instructions?.monthly || DEFAULT_SUMMARY_TEMPLATES.monthly,
        quarterly: settings.summaryConfig.instructions?.quarterly || DEFAULT_SUMMARY_TEMPLATES.quarterly,
        yearly: settings.summaryConfig.instructions?.yearly || DEFAULT_SUMMARY_TEMPLATES.yearly
    }
  };

  return (
    <div className="settings-pane settings-pane-full">
          <SummarySettingsView 
             config={combinedConfig}
             onChange={(newConfig) => {
               settings.setGlobalModels({
                 ...settings.globalModels,
                 monthlySummarySource: newConfig.monthlySummarySource
               });
               settings.setSummaryConfig({
                 ...settings.summaryConfig,
                 instructions: newConfig.templates
               });
             }}
             onResetTemplate={(type) => {
               return DEFAULT_SUMMARY_TEMPLATES[type] || '';
             }}
          />
    </div>
  );
};

const LanTransferPane: React.FC = () => {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 0, overflow: 'hidden' }}>
         <LanSyncCard
          onStartBroadcasting={async () => (window as any).api?.lan?.startBroadcasting()}
          onStopBroadcasting={async () => (window as any).api?.lan?.stopBroadcasting()}
          onStartDiscovery={async (onFound: any, onLost: any) => {
            (window as any).api?.lan?.onDeviceFound(onFound);
            (window as any).api?.lan?.onDeviceLost(onLost);
            await (window as any).api?.lan?.startDiscovery();
          }}
          onStopDiscovery={async () => (window as any).api?.lan?.stopDiscovery()}
          onSendFile={async (ip: string, port: number, progress: any) => {
            (window as any).api?.lan?.onSendProgress(progress);
            return await (window as any).api?.lan?.sendFile(ip, port);
          }}
          onFileReceivedListener={(cb: any) => (window as any).api?.lan?.onFileReceived(cb)}
          onImportZip={async (file: string) => {(window as any).api?.archive.importZip(file)}}
        />
    </div>
  );
};

const DataSyncPane: React.FC = () => {
  return (
    <div>
       <CloudSyncPanel
         onSyncNow={async (config: any) => (window as any).api?.cloud?.syncNow(config)}
         onListRecords={async (config: any) => (window as any).api?.cloud?.listRecords(config)}
         onRestore={async (config: any, filename: string) => (window as any).api?.cloud?.restore(config, filename)}
         onDeleteRecord={async (config: any, filename: string) => (window as any).api?.cloud?.deleteRecord(config, filename)}
         onBatchDelete={async (config: any, filenames: string[]) => (window as any).api?.cloud?.batchDelete(config, filenames)}
         onRename={async (config: any, oldName: string, newName: string) => (window as any).api?.cloud?.rename(config, oldName, newName)}
       />
    </div>
  );
};

const AttachmentManagementPane: React.FC = () => {
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const att = await (window as any).api?.attachment?.listAll();
        if (att) setAttachments(att);
      } catch (e) {}
    };
    fetchData();
  }, []);

  return (
    <div>
      <div className="attachment-management-wrapper" style={{ marginTop: 16 }}>
         <AttachmentManagementView 
             attachments={attachments}
             onDeleteSelected={async (ids) => await (window as any).api?.attachment?.deleteBatch(ids)}
         />
      </div>
    </div>
  );
};
