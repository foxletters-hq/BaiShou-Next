import React, { useState, useEffect } from 'react';
import { useSettingsStore, useUserProfileStore } from '@baishou/store';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdSettings, MdCloudQueue, MdStarBorder, MdSchool, MdColorLens, MdExplore, MdExtension, MdAutoAwesome, MdWifi, MdSync, MdFolderSpecial, MdArrowBack } from 'react-icons/md';
import { TitleBar } from '../../components/TitleBar';
import './SettingsPage.css';
import { useTranslation } from 'react-i18next';
import { 
  AppearanceSettingsCard, 
  DataManagementCard, 
  LanSyncCard, 
  CloudSyncPanel,
  ProfileSettingsCard,
  HotkeySettingsCard,
  WorkspaceSettingsCard,
  McpSettingsCard,
  DeveloperOptionsView,
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
  useToast
} from '@baishou/ui';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();

  const settings = useSettingsStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isClosing, setIsClosing] = useState(false);

  const TABS = [
    { id: 0, label: t('settings.nav_general', '通用'), icon: <MdSettings /> },
    { type: 'divider' },
    { id: 1, label: t('settings.nav_ai_settings', 'AI 模型服务配置'), icon: <MdCloudQueue /> },
    { id: 2, label: t('settings.nav_ai_models', '全局默认大模型'), icon: <MdStarBorder /> },
    { id: 3, label: t('settings.nav_assistant', '专属助手'), icon: <MdSchool /> },
    { type: 'divider' },
    { id: 4, label: t('settings.nav_knowledge', '外接脑容量(RAG)'), icon: <MdColorLens /> },
    { id: 5, label: t('settings.nav_search', '网络搜索 API'), icon: <MdExplore /> },
    { id: 6, label: t('settings.nav_tools', 'Agent 工具与扩展'), icon: <MdExtension /> },
    { id: 7, label: t('settings.nav_summary', '总结与归档偏好'), icon: <MdAutoAwesome /> },
    { type: 'divider' },
    { id: 8, label: t('settings.nav_lan', '局域网快传'), icon: <MdWifi /> },
    { id: 9, label: t('settings.nav_sync', '数据同步'), icon: <MdSync /> },
    { id: 10, label: t('settings.nav_attachment', '附件管理'), icon: <MdFolderSpecial /> },
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
              <button className="settings-back-btn" onClick={handleBack} title={t('common.close', '关闭返回')}>
                 <MdArrowBack />
              </button>
              <h1 className="settings-title">{t('common.settings', '偏好设置')}</h1>
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

      <div className="settings-content-area">
         <div className="settings-content-scroll" key={activeTab}>
            {renderActiveView()}
         </div>
      </div>
      </div>
    </div>
  );
};

// --- Sub-Panes Implementation ---

const GeneralSettingsView: React.FC<{ settings: any }> = ({ settings }) => {
  const { t } = useTranslation();
  const { profile, fetchProfile } = useUserProfileStore() as any;
  const [vaults, setVaults] = useState<any[]>([]);
  const [activeVault, setActiveVault] = useState<any>(null);
  
  // Local state stubs for unlinked backend properties to achieve 1:1 UI parity
  const [mcpConfig, setMcpConfig] = useState({ mcpEnabled: false, mcpPort: 31004 });
  const [identityProfile, setIdentityProfile] = useState({
    nickname: profile?.nickname || '',
    avatarPath: profile?.avatarUrl || '',
    activePersonaId: 'Default',
    personas: { 'Default': {} } as Record<string, Record<string, string>>
  });

  useEffect(() => {
    if (fetchProfile) fetchProfile();
    const fetchVaults = async () => {
      try {
        const vList = await (window as any).api?.vault?.list();
        const active = await (window as any).api?.vault?.getActive();
        if (vList) setVaults(vList);
        if (active) setActiveVault(active);
      } catch (e) {}
    };
    fetchVaults();
  }, [fetchProfile]);

  return (
    <div className="settings-pane">
       
       <div className="glass-panel-card">
         <ProfileSettingsCard 
           profile={profile || { nickname: '', autoSync: false, avatarUrl: '' }}
           onSave={async (p) => {
             if (typeof window !== 'undefined' && window.electron) {
               await window.electron.ipcRenderer.invoke('profile:update', p);
               if (fetchProfile) fetchProfile();
             }
           }}
         />
       </div>

       <div className="glass-panel-card">
         <IdentitySettingsCard 
           profile={identityProfile}
           onChange={setIdentityProfile}
         />
       </div>

       <div className="glass-panel-card">
         <AppearanceSettingsCard 
           themeMode={settings.themeMode}
           seedColor="#5BA8F5"
           language={settings.locale}
           onThemeModeChange={settings.setThemeMode}
           onSeedColorChange={() => {}}
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
           config={mcpConfig}
           onChange={setMcpConfig}
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
           storageRootPath="C:\Users\Default\BaishouStorage"
           sqliteSizeStats="12 MB"
           vectorDbStats="45 MB"
           mediaCacheStats="128 MB"
           onClearCache={() => {}}
           onVacuumDb={() => {}}
         />
       </div>

       <div className="glass-panel-card">
         <DataManagementCard 
           onExportZip={async () => {}}
           onImportZip={async () => {}}
           onPickFile={async () => null}
           snapshots={[{ filename: 'backup_v1.zip', timeLabel: '2023-11-20 14:00', sizeMB: '15.4', fullPath: '/test1' }]}
         />
       </div>

       <div className="glass-panel-card">
          <AboutSettingsCard 
              version="v2.0.0-Next-Canary"
              onOpenPrivacyPolicy={async () => await (window as any).api?.shell?.openExternal('https://github.com')}
              onOpenGithubHost={async () => await (window as any).api?.shell?.openExternal('https://github.com/Anson-Trio/BaiShou')}
          />
       </div>

    </div>
  );
};

const AiModelServicesPane: React.FC<{ settings: any }> = ({ settings }) => {
  const { t } = useTranslation();
  const toast = useToast();

  return (
    <div className="settings-pane">
      <div className="glass-panel-card">
         <AIModelServicesView 
             providers={settings.aiProviderConfigs || {}}
             onUpdateProvider={(id, updates) => settings.updateAiProviderConfig(id, updates)}
             onTestConnection={async (provId) => {
               try {
                 await (window as any).api?.settings?.testProviderConnection(provId);
                 toast.showSuccess(t('services.test_success', '访问连接成功，连通无碍'));
               } catch (e: any) {
                 toast.showError(t('services.test_fail', '连接或测试验证失败。') + e.message);
               }
             }}
             onFetchModels={async (provId) => {
               try {
                 const models = await (window as any).api?.settings?.fetchModels(provId);
                 toast.showSuccess(t('services.fetch_success', '成功拉取模型名单结构'));
                 return models;
               } catch (e: any) {
                 toast.showError(t('services.fetch_fail', '获取列表失败：') + e.message);
                 return [];
               }
             }}
         />
      </div>
    </div>
  );
};

const AiGlobalModelsPane: React.FC<{ settings: any }> = ({ settings }) => {
  return (
    <div className="settings-pane">
      {settings.globalModelsConfig && (
        <div className="glass-panel-card">
           <AIGlobalModelsView 
               config={settings.globalModelsConfig}
               availableProviders={settings.aiProviderConfigs || {}}
               onChange={(config) => settings.setGlobalModelsConfig(config)}
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
    <div className="settings-pane">
      {settings.userProfileConfig && (
        <div className="glass-panel-card">
            <IdentitySettingsCard 
                profile={settings.userProfileConfig}
                onChange={(profile) => settings.setUserProfileConfig(profile)}
            />
        </div>
      )}
      <div className="glass-panel-card">
         <AssistantMatrixCard onLaunchMatrix={async () => {
           await (window as any).api?.navigation?.navigateTo('matrix');
         }} />
      </div>
    </div>
  );
};

const RagSettingsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const [ragStats, setRagStats] = useState<any>({ totalCount: 0, currentDimension: 0, totalSizeText: '0 KB' });
  const [ragEntries, setRagEntries] = useState<any[]>([]);

  useEffect(() => {
    const fetchRagInfo = async () => {
      try {
        const s = await (window as any).api?.rag?.getStats();
        if (s) setRagStats(s);
        const e = await (window as any).api?.rag?.queryEntries({ limit: 50 });
        if (e) setRagEntries(e);
      } catch (err) {}
    };
    fetchRagInfo();
  }, []);

  if (!settings.ragConfig) return <div />;
  return (
    <div className="settings-pane">
      <div className="glass-panel-card">
         <RagMemoryView 
             config={settings.ragConfig}
             stats={ragStats}
             ragState={{ isRunning: false, type: 'idle', progress: 0, total: 0, statusText: '' }}
             hasMismatchModel={false}
             entries={ragEntries}
             onChange={(config) => settings.setRagConfig(config)}
             onClearDimension={async () => await (window as any).api?.rag?.clearDimension()}
             onBatchEmbed={async () => await (window as any).api?.rag?.triggerBatchEmbed()}
             onAddManualMemory={async () => await (window as any).api?.rag?.addManualMemory()}
             onTriggerMigration={async () => await (window as any).api?.rag?.triggerMigration()}
             onClearAll={async () => await (window as any).api?.rag?.clearAll()}
             onSearch={(q) => (window as any).api?.rag?.queryEntries({ keyword: q })}
             onDeleteEntry={async (id) => await (window as any).api?.rag?.deleteEntry(id)}
             onEditEntry={async (entry) => await (window as any).api?.rag?.editEntry(entry.embeddingId, entry)}
         />
      </div>
    </div>
  );
};

const WebSearchPane: React.FC<{ settings: any }> = ({ settings }) => {
  if (!settings.webSearchConfig || !settings.summaryConfig) return <div />;
  return (
    <div className="settings-pane">
       <div className="glass-panel-card">
         <WebSearchSettingsView 
             searchConfig={settings.webSearchConfig}
             summaryConfig={settings.summaryConfig}
             onSearchChange={(config) => settings.setWebSearchConfig(config)}
             onSummaryChange={(config) => settings.setSummaryConfig(config)}
         />
       </div>
    </div>
  );
};

const AgentToolsPane: React.FC<{ settings: any }> = ({ settings }) => {
  if (!settings.toolManagementConfig) return <div />;
  return (
    <div className="settings-pane">
       <div className="glass-panel-card">
         <AgentToolsView 
             config={settings.toolManagementConfig}
             onChange={(config) => settings.setToolManagementConfig(config)}
         />
       </div>
       {settings.mcpServerConfig && (
        <div className="glass-panel-card">
           <McpSettingsCard 
               config={settings.mcpServerConfig}
               onChange={(config) => settings.setMcpServerConfig(config)}
           />
        </div>
       )}
       <div className="glass-panel-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
         <DeveloperOptionsView />
       </div>
    </div>
  );
};

const SummarySettingsPane: React.FC<{ settings: any }> = () => {
  return (
    <div className="settings-pane">
       <div className="glass-panel-card">
          <p style={{ color: 'var(--color-on-surface-variant)' }}>Summary settings logic mapped here.</p>
       </div>
    </div>
  );
};

const LanTransferPane: React.FC = () => {
  return (
    <div className="settings-pane">
      <div className="glass-panel-card">
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
    </div>
  );
};

const DataSyncPane: React.FC = () => {
  return (
    <div className="settings-pane">
      <div className="glass-panel-card">
        <CloudSyncPanel
          onSyncNow={async (config: any) => (window as any).api?.cloud?.syncNow(config)}
          onListRecords={async (config: any) => (window as any).api?.cloud?.listRecords(config)}
          onRestore={async (config: any, filename: string) => (window as any).api?.cloud?.restore(config, filename)}
          onDeleteRecord={async (config: any, filename: string) => (window as any).api?.cloud?.deleteRecord(config, filename)}
          onBatchDelete={async (config: any, filenames: string[]) => (window as any).api?.cloud?.batchDelete(config, filenames)}
          onRename={async (config: any, oldName: string, newName: string) => (window as any).api?.cloud?.rename(config, oldName, newName)}
        />
      </div>
    </div>
  );
};

const AttachmentManagementPane: React.FC = () => {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [stats, setStats] = useState({ sqliteSizeStats: '...', vectorDbStats: '...', mediaCacheStats: '...' });
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snaps = await (window as any).api?.archive?.listSnapshots();
        if (snaps) setSnapshots(snaps);
        const st = await (window as any).api?.storage?.getStats();
        if (st) setStats(st);
        const att = await (window as any).api?.attachment?.listAll();
        if (att) setAttachments(att);
      } catch (e) {}
    };
    fetchData();
  }, []);

  return (
    <div className="settings-pane">
      <div className="glass-panel-card">
        <DataManagementCard 
          onExportZip={async () => await (window as any).api?.archive?.exportZip()}
          onImportZip={async (file: string) => await (window as any).api?.archive?.importZip(file)}
          onPickFile={async () => await (window as any).api?.archive?.pickZip()}
          snapshots={snapshots}
        />
      </div>
      <div className="glass-panel-card">
         <StorageSettingsCard 
             sqliteSizeStats={stats.sqliteSizeStats}
             vectorDbStats={stats.vectorDbStats}
             mediaCacheStats={stats.mediaCacheStats}
             onClearCache={async () => await (window as any).api?.storage?.clearCache()}
             onVacuumDb={async () => await (window as any).api?.storage?.vacuumDb()}
         />
      </div>
      <div className="glass-panel-card">
         <AttachmentManagementView 
             attachments={attachments}
             onDeleteSelected={async (ids) => await (window as any).api?.attachment?.deleteBatch(ids)}
         />
      </div>
    </div>
  );
};
