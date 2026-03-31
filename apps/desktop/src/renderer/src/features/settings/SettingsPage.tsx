import React, { useState, useEffect } from 'react';
import { AppearanceSettingsCard, SettingsItem } from '@baishou/ui';
import { AIModelServicesView } from '@baishou/ui/src/web/AIModelServicesView';
import { AIGlobalModelsView, type ProviderModelMap } from '@baishou/ui/src/web/AIGlobalModelsView';
import { FeatureSettingsView } from '@baishou/ui/src/web/FeatureSettingsView';
import { useSettingsStore } from '@baishou/store';
import './SettingsPage.css';

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

const MOCK_AVAILABLE_MODELS: ProviderModelMap = {
  'openai': ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  'anthropic': ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'],
  'gemini': ['gemini-1.5-pro', 'gemini-1.5-flash']
};

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'ai' | 'features'>('appearance');

  useEffect(() => {
    // 组件挂载时拉取真实配置
    settings.loadConfig();
  }, []);

  return (
    <div className="settings-page-container" style={{ display: 'flex', gap: '32px' }}>
      <div className="settings-sidebar" style={{ width: 200, flexShrink: 0 }}>
        <h2 className="settings-page-title" style={{ marginBottom: 24, paddingLeft: 12 }}>{t('settings.title') || '设置'}</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button 
            className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            🎨 外观与通用
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            🧠 AI 模型与服务
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === 'features' ? 'active' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            ⚙️ 功能与特性
          </button>
        </div>
      </div>
      
      <div className="settings-content" style={{ flex: 1, paddingBottom: 64 }}>
        {activeTab === 'appearance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <AppearanceSettingsCard 
              themeMode={settings.themeMode}
              seedColor="#4ade80"
              language={settings.locale}
              onThemeModeChange={settings.setThemeMode}
              onSeedColorChange={() => {}}
              onLanguageChange={settings.setLocale}
            />

            <div>
              <h3 style={{ fontSize: 16, marginBottom: 8, paddingLeft: 8, color: 'var(--text-secondary)' }}>
                {t('settings.general_title') || '数据与隐私'}
              </h3>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid rgba(148,163,184,0.3)', overflow: 'hidden' }}>
                <SettingsItem title="数据同步" subtitle="通过 WebDAV 跨端同步日记与设定" onClick={() => {}} />
                <SettingsItem title="局域网传输" subtitle="在相同 Wi-Fi 下快速同步大型记忆文件" onClick={() => {}} />
                <SettingsItem title="存储目录管理" subtitle="查看离线向量库占用情况" onClick={() => {}} />
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 16, marginBottom: 8, paddingLeft: 8, color: 'var(--text-secondary)' }}>
                {t('settings.about_title') || '关于白守'}
              </h3>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid rgba(148,163,184,0.3)', overflow: 'hidden' }}>
                <SettingsItem title="当前版本" rightElement={<span style={{color:'var(--text-secondary)',fontSize:13}}>v1.0.0-beta</span>} />
                <SettingsItem title="隐私政策" onClick={() => {}} />
                <SettingsItem title="开源协议" onClick={() => {}} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {settings.isLoading ? (
               <div style={{ padding: 20 }}>读取配置加载中...</div>
            ) : (
               <AIModelServicesView 
                 providers={settings.providers}
                 onUpdateProvider={settings.updateProvider}
                 onToggleProvider={settings.toggleProvider}
               />
            )}
            
            <div style={{ height: 1, backgroundColor: 'rgba(148,163,184,0.2)' }} />

            <AIGlobalModelsView 
              config={settings.globalModels || { defaultProviderId: 'openai', defaultModelId: 'gpt-4', reasoningProviderId: 'anthropic', reasoningModelId: 'claude-3-5' }}
              availableModels={MOCK_AVAILABLE_MODELS}
              onChange={settings.setGlobalModels}
            />
          </div>
        )}

        {activeTab === 'features' && (
          <FeatureSettingsView 
            config={settings.features || { ragEnabled: true, ragSimilarityThreshold: 0.85, searchMaxResults: 10, searchIncludeDiary: true, summaryAutoGenerate: true, devModeEnabled: false }}
            onChange={settings.setFeatureSettings}
          />
        )}
      </div>
    </div>
  );
};
