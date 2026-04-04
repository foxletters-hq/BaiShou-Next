import React, { useState } from 'react';
import './AppearanceSettingsCard.css';
import { useTranslation } from 'react-i18next';
import { MdPalette, MdExpandMore } from 'react-icons/md';

export interface AppearanceSettingsProps {
  themeMode: 'system' | 'light' | 'dark';
  seedColor: string;
  language?: string;
  onThemeModeChange: (mode: 'system' | 'light' | 'dark') => void;
  onSeedColorChange: (color: string) => void;
  onLanguageChange: (lang: string) => void;
}

const PRESET_COLORS = [
  '#9AD4EA', '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'
];

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  seedColor,
  language = 'system',
  onThemeModeChange,
  onSeedColorChange,
  onLanguageChange
}) => {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  // Determine if the current color is a custom one
  const isCustomColor = !PRESET_COLORS.includes(seedColor.toUpperCase()) && !PRESET_COLORS.includes(seedColor);

  const LANGS = [
    { val: 'system', label: t('settings.language_system', '跟随系统') },
    { val: 'zh', label: t('settings.language_zh', '简体中文') },
    { val: 'zh-TW', label: t('settings.language_zh_tw', '繁體中文') },
    { val: 'en', label: t('settings.language_en', 'English') },
    { val: 'ja', label: t('settings.language_ja', '日本語') },
  ];

  const getThemeText = () => {
  switch (themeMode) {
      case 'system': return t('settings.theme_system', '系统跟随');
      case 'light': return t('settings.theme_light', '日间清晰');
      case 'dark': return t('settings.theme_dark', '夜宴暗影');
    }
  };

  const getLangText = () => {


    return LANGS.find(l => l.val === language)?.label || t('settings.language_system', '跟随系统');
  };

  return (
    <div className="appearance-card-container settings-card">
      <details className="settings-expansion-tile">
        <summary className="settings-expansion-summary">
          <div className="settings-leading-icon">
            <MdPalette size={24} />
          </div>
          <div className="settings-title-group">
            <h3 className="settings-title">{t('settings.appearance', '外观与主题')}</h3>
            <p className="settings-subtitle">{getThemeText()} · {getLangText()}</p>
          </div>
          <div className="settings-trailing-icon">
            <MdExpandMore size={24} />
          </div>
        </summary>
        
        <div className="settings-expansion-content">
          <div className="appearance-row">
            <label className="settings-label">{t('settings.theme_mode', '光照模式')}</label>
            <div className="theme-segmented-btn">
              <button 
                className={`seg-btn ${themeMode === 'system' ? 'active' : ''}`}
                onClick={() => onThemeModeChange('system')}
              >
                {t('settings.theme_system', '系统跟随')}
              </button>
              <button 
                className={`seg-btn ${themeMode === 'light' ? 'active' : ''}`}
                onClick={() => onThemeModeChange('light')}
              >
                {t('settings.theme_light', '日间清晰')}
              </button>
              <button 
                className={`seg-btn ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => onThemeModeChange('dark')}
              >
                {t('settings.theme_dark', '夜宴暗影')}
              </button>
            </div>
          </div>

          <div className="appearance-row">
            <label className="settings-label">{t('settings.theme_color', '基核种子色')}</label>
            <div className="color-palette">
              {PRESET_COLORS.map(c => (
                <div 
                  key={c}
                  className={`color-dot ${seedColor.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => onSeedColorChange(c)}
                >
                  {seedColor.toUpperCase() === c.toUpperCase() && <span className="color-dot-check">✓</span>}
                </div>
              ))}
              <div 
                className={`color-dot custom-color-picker ${isCustomColor ? 'active' : ''}`}
                style={{ background: isCustomColor ? seedColor : 'linear-gradient(45deg, #FF6B6B, #FFD93D, #4D96FF, #C77DFF)' }}
                onClick={() => setShowPicker(!showPicker)}
              >
                {isCustomColor ? <span className="color-dot-check">✓</span> : '+'}
              </div>

              {showPicker && (
                <div className="color-native-wrapper">
                  <input 
                    type="color" 
                    value={seedColor}
                    onChange={(e) => onSeedColorChange(e.target.value)}
                    onBlur={() => setShowPicker(false)}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="appearance-row divider-row">
            <div className="settings-divider" />
          </div>

          <div className="appearance-row" style={{ marginTop: '8px' }}>
            <label className="settings-label">{t('settings.language', '界译语言')}</label>
            <div className="lang-chips">
              {LANGS.map(l => (
                <div 
                  key={l.val}
                  className={`lang-chip ${language === l.val ? 'active' : ''}`}
                  onClick={() => onLanguageChange(l.val)}
                >
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};
