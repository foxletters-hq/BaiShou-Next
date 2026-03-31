import React, { useState } from 'react';
import './AppearanceSettingsCard.css';

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

const LANGS = [
  { val: 'system', label: '跟随系统' },
  { val: 'zh', label: '简体中文' },
  { val: 'zh-TW', label: '繁體中文' },
  { val: 'en', label: 'English' },
  { val: 'ja', label: '日本語' },
];

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  seedColor,
  language = 'system',
  onThemeModeChange,
  onSeedColorChange,
  onLanguageChange
}) => {
  const [showPicker, setShowPicker] = useState(false);

  // 判断当前颜色是否为预设之一
  const isCustomColor = !PRESET_COLORS.includes(seedColor.toUpperCase()) && !PRESET_COLORS.includes(seedColor);

  return (
    <div className="appearance-card-container">
      <div className="appearance-header">
         <span className="appearance-icon">🎨</span>
         <div className="appearance-title-group">
            <h3>环境与感知 (Appearance)</h3>
            <p>全盘接管系统的深浅模式与界面核心强调色调。</p>
         </div>
      </div>

      <div className="appearance-row">
        <label>光照模式 (Theme)</label>
        <div className="theme-toggle-group">
          <button 
            className={`theme-btn ${themeMode === 'system' ? 'active' : ''}`}
            onClick={() => onThemeModeChange('system')}
          >
            💻 系统跟随
          </button>
          <button 
            className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`}
            onClick={() => onThemeModeChange('light')}
          >
            ☀️ 日间清晰
          </button>
          <button 
            className={`theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
            onClick={() => onThemeModeChange('dark')}
          >
            🌙 夜宴暗影
          </button>
        </div>
      </div>

      <div className="appearance-row">
        <label>基核种子色 (Seed Color)</label>
        <div className="color-palette">
           {PRESET_COLORS.map(c => (
             <div 
               key={c}
               className={`color-dot ${seedColor.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
               style={{ backgroundColor: c }}
               onClick={() => onSeedColorChange(c)}
             />
           ))}
           <div 
             className={`color-dot custom-color-picker ${isCustomColor ? 'active' : ''}`}
             style={{ background: isCustomColor ? seedColor : 'linear-gradient(45deg, #FF6B6B, #FFD93D, #4D96FF, #C77DFF)' }}
             onClick={() => setShowPicker(!showPicker)}
           >
             {isCustomColor ? '' : '+'}
           </div>

           {showPicker && (
             <div className="color-native-wrapper">
                <input 
                  type="color" 
                  value={seedColor}
                  onChange={(e) => onSeedColorChange(e.target.value)}
                  onBlur={() => setShowPicker(false)}
                />
                <span className="color-hint">选择后点击他处关闭</span>
             </div>
           )}
        </div>
      </div>

      <div className="appearance-row" style={{ marginTop: '8px' }}>
        <label>界译语言 (Locale)</label>
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
  );
};
