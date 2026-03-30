import React from 'react';
import { AppearanceSettingsCard, SettingsItem } from '@baishou/ui';
import { useSettingsMock } from './hooks/useSettingsMock';
import './SettingsPage.css';

// TODO: [Agent1-Dependency] 替换
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { state, actions } = useSettingsMock();

  return (
    <div className="settings-page-container">
      <h2 className="settings-page-title">{t('settings.title') || '设置'}</h2>
      
      {/* 1:1 复刻的外观设置卡片 - 纯响应 */}
      <AppearanceSettingsCard 
        themeMode={state.themeMode}
        seedColor={state.seedColor}
        language={state.language}
        onThemeModeChange={actions.setThemeMode}
        onSeedColorChange={actions.setSeedColor}
        onLanguageChange={actions.setLanguage}
      />

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 8, paddingLeft: 8, color: 'var(--text-secondary)' }}>
          {t('settings.general_title') || '通用设置'}
        </h3>
        <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid rgba(148,163,184,0.5)', overflow: 'hidden' }}>
          <SettingsItem 
            title={t('settings.data_sync') || '数据同步'} 
            onClick={() => console.log('Data sync')}
          />
        </div>
      </div>
    </div>
  );
};
