import React, { useState, useEffect } from 'react';

import { useSettingsStore, useUserProfileStore } from '@baishou/store';
import './SettingsPage.css';
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
  AssistantMatrixCard
} from '@baishou/ui';


// ----------------------------------------------------
// TABS 定义
// ----------------------------------------------------
type TabId = 'profile' | 'general' | 'storage' | 'ai' | 'rag' | 'advanced';

const SETTINGS_TABS: Array<{ id: TabId; icon: string; label: string; desc: string }> = [
  { id: 'profile', icon: '👤', label: '个人名片', desc: '身份管理与人设' },
  { id: 'general', icon: '🎨', label: '通用偏好', desc: '外观、热键与工作区' },
  { id: 'storage', icon: '💾', label: '数据与存储', desc: '快照与大局网传输' },
  { id: 'ai', icon: '🧠', label: '大脑引擎', desc: '分发流与 LLM 集群' },
  { id: 'rag', icon: '📚', label: '外脑建设', desc: '搜索与私有记忆层' },
];

export const SettingsPage: React.FC = () => {
  const settings = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  useEffect(() => {
    settings.loadConfig();
  }, [settings.loadConfig]);

  return (
    <div className="settings-page-wrapper">
      <div className="settings-page-glow" />

      {/* 侧边导航 */}
      <nav className="settings-sidebar">
        <h1 className="settings-header-title">配置中心</h1>
        <div className="settings-nav-group">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="settings-nav-icon">{tab.icon}</div>
              <div className="settings-nav-text">
                 <span className="settings-nav-label">{tab.label}</span>
                 <span className="settings-nav-desc">{tab.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </nav>

      {/* 右侧动态渲染面板区 */}
      <main className="settings-content-area">
         {settings.isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100, color: 'var(--text-secondary)' }}>
              加载系统环境配置中...
            </div>
         ) : (
            <div className="settings-content-scroll" key={activeTab}>
              {activeTab === 'profile' && <ProfilePane settings={settings} />}
              {activeTab === 'general' && <GeneralPane settings={settings} />}
              {activeTab === 'storage' && <StoragePane />}
              {activeTab === 'ai' && <AiPane settings={settings} />}
              {activeTab === 'rag' && <RagPane settings={settings} />}
              {activeTab === 'advanced' && <AdvancedPane settings={settings} />}
            </div>
         )}
      </main>

    </div>
  );
};

// ----------------------------------------------------
// 拆分子面板集 (全面替换了 Mock 数据)
// ----------------------------------------------------

const ProfilePane: React.FC<{ settings: any }> = ({ settings }) => {
  const { profile, fetchProfile } = useUserProfileStore() as any;
  
  useEffect(() => {
    if (fetchProfile) fetchProfile();
  }, [fetchProfile]);

  return (
    <>
      <div>
        <h2 className="pane-section-title">个人偏好库</h2>
        <p className="pane-section-subtitle">配置您的昵称、签名档以及多身份分身档案库。</p>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
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

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {settings.userProfileConfig && (
            <IdentitySettingsCard 
                profile={settings.userProfileConfig}
                onChange={(profile) => settings.setUserProfileConfig(profile)}
            />
         )}
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         <AssistantMatrixCard onLaunchMatrix={async () => {
           await (window as any).api?.navigation?.navigateTo('matrix');
         }} />
      </div>
    </>
  );
};

const GeneralPane: React.FC<{ settings: any }> = ({ settings }) => {
  const [vaults, setVaults] = useState<any[]>([]);
  const [activeVault, setActiveVault] = useState<any>(null);

  useEffect(() => {
    const fetchVaults = async () => {
      try {
        const vList = await (window as any).api?.vault?.list();
        const active = await (window as any).api?.vault?.getActive();
        if (vList) setVaults(vList);
        if (active) setActiveVault(active);
      } catch (e) {
        console.warn("API Error (vault):", e);
      }
    };
    fetchVaults();
  }, []);

  return (
    <>
      <div>
        <h2 className="pane-section-title">基础视觉与使用环境</h2>
        <p className="pane-section-subtitle">调整白守的沉浸感主题、唤出热键等通用系统参数。</p>
      </div>

      <div className="glass-panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        <AppearanceSettingsCard 
          themeMode={settings.themeMode}
          seedColor="#4ade80"
          language={settings.locale}
          onThemeModeChange={settings.setThemeMode}
          onSeedColorChange={() => {}}
          onLanguageChange={settings.setLocale}
        />
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         <WorkspaceSettingsCard 
            vaults={vaults.length > 0 ? vaults : [{ name: 'Loading...', path: '暂无数据' }]}
            activeVault={activeVault || vaults[0] || null}
            onSwitch={async (id) => await (window as any).api?.vault?.switchActive(id)}
            onDelete={async (id) => await (window as any).api?.vault?.delete(id)}
            onCreate={async () => await (window as any).api?.vault?.createDialog()}
         />
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {settings.hotkeyConfig ? (
             <HotkeySettingsCard 
                 config={settings.hotkeyConfig}
                 onChange={(config) => settings.setHotkeyConfig(config)}
             />
         ) : null}
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         <AboutSettingsCard 
             version="v2.0.0-Next-Canary"
             onOpenPrivacyPolicy={async () => await (window as any).api?.shell?.openExternal('https://github.com')}
             onOpenGithubHost={async () => await (window as any).api?.shell?.openExternal('https://github.com/Anson-Trio/BaiShou')}
         />
      </div>
    </>
  );
};

const StoragePane: React.FC = () => {
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
      } catch (e) {
        console.warn("API Error (storage/archive/attachment):", e);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <div>
        <h2 className="pane-section-title">数据管理与流通</h2>
        <p className="pane-section-subtitle">接管云驱动器同步以及近场通讯的设备级网络协同。</p>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
        <DataManagementCard 
          onExportZip={async () => await (window as any).api?.archive?.exportZip()}
          onImportZip={async (file: string) => await (window as any).api?.archive?.importZip(file)}
          onPickFile={async () => await (window as any).api?.archive?.pickZip()}
          snapshots={snapshots}
        />
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
        <div style={{ padding: 24 }}>
           <StorageSettingsCard 
               sqliteSizeStats={stats.sqliteSizeStats}
               vectorDbStats={stats.vectorDbStats}
               mediaCacheStats={stats.mediaCacheStats}
               onClearCache={async () => await (window as any).api?.storage?.clearCache()}
               onVacuumDb={async () => await (window as any).api?.storage?.vacuumDb()}
           />
        </div>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
        <div style={{ padding: 24 }}>
           <AttachmentManagementView 
               attachments={attachments}
               onDeleteSelected={async (ids) => await (window as any).api?.attachment?.deleteBatch(ids)}
           />
        </div>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {/* Phase B LAN Sync */}
         <div style={{ padding: 24 }}>
           <h3 style={{ fontSize: 16, marginBottom: 12 }}>近场传输 (Lan Sync)</h3>
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

      <div className="glass-panel-card" style={{ padding: 0 }}>
        <CloudSyncPanel
          onSyncNow={async (config: any) => (window as any).api?.cloud?.syncNow(config)}
          onListRecords={async (config: any) => (window as any).api?.cloud?.listRecords(config)}
          onRestore={async (config: any, filename: string) => (window as any).api?.cloud?.restore(config, filename)}
          onDeleteRecord={async (config: any, filename: string) => (window as any).api?.cloud?.deleteRecord(config, filename)}
          onBatchDelete={async (config: any, filenames: string[]) => (window as any).api?.cloud?.batchDelete(config, filenames)}
          onRename={async (config: any, oldName: string, newName: string) => (window as any).api?.cloud?.rename(config, oldName, newName)}
        />
      </div>
    </>
  );
};

const AiPane: React.FC<{ settings: any }> = ({ settings }) => {
  return (
    <>
      <div>
        <h2 className="pane-section-title">智能神经引擎</h2>
        <p className="pane-section-subtitle">统一绑定云服务商 Key，并进行四维模型下发与分流器部署。</p>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {settings.globalModelsConfig && (
             <AIGlobalModelsView 
                 config={settings.globalModelsConfig}
                 availableProviders={settings.aiProviderConfigs || {}}
                 onChange={(config) => settings.setGlobalModelsConfig(config)}
                 onEmbeddingMigrationRequest={async () => true}
             />
         )}
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {settings.agentBehaviorConfig && (
             <AgentBehaviorSettingsCard 
                 config={settings.agentBehaviorConfig}
                 onChange={(config) => settings.setAgentBehaviorConfig(config)}
             />
         )}
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         <AIModelServicesView 
             providers={settings.aiProviderConfigs || {}}
             onUpdateProvider={(id, updates) => settings.updateAiProviderConfig(id, updates)}
             onTestConnection={async (provId) => await (window as any).api?.settings?.testProviderConnection(provId)}
             onFetchModels={async (provId) => await (window as any).api?.settings?.fetchModels(provId)}
         />
      </div>
    </>
  );
};

const RagPane: React.FC<{ settings: any }> = ({ settings }) => {
  const [ragStats, setRagStats] = useState<any>({ totalCount: 0, currentDimension: 0, totalSizeText: '0 KB' });
  const [ragEntries, setRagEntries] = useState<any[]>([]);

  useEffect(() => {
    const fetchRagInfo = async () => {
      try {
        const s = await (window as any).api?.rag?.getStats();
        if (s) setRagStats(s);

        const e = await (window as any).api?.rag?.queryEntries({ limit: 50 });
        if (e) setRagEntries(e);
      } catch (err) {
        console.warn("API Error (rag):", err);
      }
    };
    fetchRagInfo();
  }, []);

  return (
    <>
      <div>
        <h2 className="pane-section-title">工具集与外挂存储</h2>
        <p className="pane-section-subtitle">配置白守 RAG 检索深度指标及外挂工具箱权限。</p>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {settings.ragConfig && (
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
         )}
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {settings.webSearchConfig && settings.summaryConfig && (
             <WebSearchSettingsView 
                 searchConfig={settings.webSearchConfig}
                 summaryConfig={settings.summaryConfig}
                 onSearchChange={(config) => settings.setWebSearchConfig(config)}
                 onSummaryChange={(config) => settings.setSummaryConfig(config)}
             />
         )}
      </div>
      
      <div className="glass-panel-card" style={{ padding: 0 }}>
         {settings.toolManagementConfig && (
             <AgentToolsView 
                 config={settings.toolManagementConfig}
                 onChange={(config) => settings.setToolManagementConfig(config)}
             />
         )}
      </div>
    </>
  );
}

const AdvancedPane: React.FC<{ settings: any }> = ({ settings }) => {
  return (
    <>
      <div>
        <h2 className="pane-section-title">高级控制选项</h2>
        <p className="pane-section-subtitle">Model Context Protocol 对外局域暴露，以及深度研发设定。</p>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {settings.mcpServerConfig ? (
             <McpSettingsCard 
                 config={settings.mcpServerConfig}
                 onChange={(config) => settings.setMcpServerConfig(config)}
             />
         ) : null}
      </div>

      <div className="glass-panel-card" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
         <DeveloperOptionsView />
      </div>
    </>
  );
}
