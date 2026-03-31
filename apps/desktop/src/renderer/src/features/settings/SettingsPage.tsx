import React, { useState, useEffect } from 'react';

import { useSettingsStore } from '@baishou/store';
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
  { id: 'advanced', icon: '⚙️', label: '极客扩展', desc: 'MCP 面板与调试' },
];
>>>>>>> feat/gamma-settings

const MOCK_AVAILABLE_MODELS: ProviderModelMap = {
  'openai': ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  'anthropic': ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'],
  'gemini': ['gemini-1.5-pro', 'gemini-1.5-flash']
};

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
// 拆分子面板集 (目前作为 Phase 分步的入口空壳/占位集成)
// ----------------------------------------------------

const ProfilePane: React.FC<{ settings: any }> = ({ settings }) => {
  return (
    <>
      <div>
        <h2 className="pane-section-title">个人偏好库</h2>
        <p className="pane-section-subtitle">配置您的昵称、签名档以及多身份分身档案库。</p>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {/* 保留原本的 ProfileSettingsCard 挂载位 */}
         <ProfileSettingsCard 
           profile={{ nickname: '指挥官 (Commander)', autoSync: true, avatarUrl: '' }}
           onSave={(p) => console.log('Saved profile', p)}
           onPickAvatar={async () => {
             // 预留接线：(window.api as any).profile.pickAndSaveAvatar()
           }}
           onGenerateAvatar={() => {}}
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
         <AssistantMatrixCard onLaunchMatrix={async () => console.log('前往特型数字生命车间...')} />
      </div>
    </>
  );
};

const GeneralPane: React.FC<{ settings: any }> = ({ settings }) => {
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
            vaults={[{ name: 'Default', path: '~/Documents/BaiShou', createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString() }]}
            activeVault={{ name: 'Default', path: '~/Documents/BaiShou', createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString() }}
            onSwitch={() => {}}
            onDelete={() => {}}
            onCreate={async () => {}}
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
             onOpenPrivacyPolicy={() => console.log('打开开发哲学与隐私协议')}
             onOpenGithubHost={() => console.log('导航到 Github Issue')}
         />
      </div>
    </>
  );
};

const StoragePane: React.FC = () => {
  return (
    <>
      <div>
        <h2 className="pane-section-title">数据管理与流通</h2>
        <p className="pane-section-subtitle">接管云驱动器同步以及近场通讯的设备级网络协同。</p>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
        <DataManagementCard 
          onExportZip={async () => {(window as any).api?.archive.exportZip()}}
          onImportZip={async (file: string) => {(window as any).api?.archive.importZip(file)}}
          onPickFile={async () => await (window as any).api?.archive.pickZip()}
          snapshots={[
            { filename: 'auto_backup_01.zip', sizeMB: '14.2', fullPath: '/tmp/01.zip', timeLabel: '2 小时前自动留存' },
            { filename: 'auto_backup_02.zip', sizeMB: '13.8', fullPath: '/tmp/02.zip', timeLabel: '昨天 23:14' }
          ]}
        />
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
        <div style={{ padding: 24 }}>
           <StorageSettingsCard 
               sqliteSizeStats="142 MB"
               vectorDbStats="2.1 GB"
               mediaCacheStats="450 MB"
               onClearCache={() => alert("清理系统缓存")}
               onVacuumDb={() => alert("VACUUM 命令已执行")}
           />
        </div>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
        <div style={{ padding: 24 }}>
           <AttachmentManagementView 
               attachments={[
                  { id: '1', name: 'midjourney-prompt-ref.png', sizeMB: 2.4, type: 'image', date: '2026-03-31', isOrphan: false, fileCount: 1 },
                  { id: '2', name: 'claude-3-opus-guidelines.pdf', sizeMB: 1.2, type: 'document', date: '2026-03-29', isOrphan: true, fileCount: 3 }
               ]}
               onDeleteSelected={async (ids) => console.log('Delete attachment', ids)}
           />
        </div>
      </div>

      <div className="glass-panel-card" style={{ padding: 0 }}>
         {/* TODO: Phase B 追加 LanSyncCard */}
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
             onTestConnection={async () => await new Promise(r => setTimeout(r, 800))}
             onFetchModels={async () => ['gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus']}
         />
      </div>
    </>
  );
};

const RagPane: React.FC<{ settings: any }> = ({ settings }) => {
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
                 stats={{ totalCount: 4210, currentDimension: 1536, totalSizeText: '48.2 MB' }}
                 ragState={{ isRunning: false, type: 'idle', progress: 0, total: 0, statusText: '' }}
                 hasMismatchModel={false}
                 entries={[
                    { embeddingId: 'e1', text: '记录了白守初始化配置的一段核心思维...', modelId: 'text-embedding-3-small', createdAt: Date.now() }
                 ]}
                 onChange={(config) => settings.setRagConfig(config)}
                 onClearDimension={async () => {}}
                 onBatchEmbed={async () => {}}
                 onAddManualMemory={async () => {}}
                 onTriggerMigration={async () => {}}
                 onClearAll={async () => {}}
                 onSearch={(q) => console.log(q)}
                 onDeleteEntry={async () => {}}
                 onEditEntry={async () => {}}
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
                 config={settings.mcpServerConfig!}
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
