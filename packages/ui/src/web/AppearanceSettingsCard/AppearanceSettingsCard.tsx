import React, { useState } from 'react';
import './AppearanceSettingsCard.css';

interface AppearanceSettingsProps {
  themeMode: 'system' | 'light' | 'dark';
  seedColor: string;
  language: 'system' | 'zh' | 'en' | 'ja' | 'zh-TW';
  onThemeModeChange: (mode: 'system' | 'light' | 'dark') => void;
  onSeedColorChange: (color: string) => void;
  onLanguageChange: (lang: 'system' | 'zh' | 'en' | 'ja' | 'zh-TW') => void;
}

// TODO: [Agent1-Dependency] 替换
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  seedColor,
  language,
  onThemeModeChange,
  onSeedColorChange,
  onLanguageChange
}) => {
  const { t } = useTranslation();
  
  // NOTE: 展开状态和模态框状态属于"组件自身私有交互状态"，不涉及业务数据存储，
  // 保留在组件内符合 SRP（容器组件无须关心弹窗是否展开）
  const [expanded, setExpanded] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [hue, setHue] = useState(190);
  const [sat, setSat] = useState(60);
  const [lit, setLit] = useState(75);

  const previewColor = hslToHex(hue, sat, lit);

  const openColorPicker = () => {
    setHue(190); setSat(60); setLit(75);
    setShowColorModal(true);
  };

  const saveColor = () => {
    onSeedColorChange(previewColor);
    setShowColorModal(false);
  };

  return (
    <>
      <div className={`appearance-settings-card ${expanded ? 'expanded' : ''}`}>
        <div className="asc-header" onClick={() => setExpanded(!expanded)}>
          <div className="asc-header-icon">🎨</div>
          <div className="asc-header-body">
            <div className="asc-title">{t('settings.appearance') || '外观与多语言'}</div>
            <div className="asc-subtitle">
              {themeMode} · {language}
            </div>
          </div>
          <div className="asc-header-arrow">▼</div>
        </div>
        
        <div className="asc-content-wrapper">
          <div className="asc-content">
            <div className="asc-section">
              <div className="asc-label">{t('settings.theme_mode') || '主题模式'}</div>
              <div className="asc-segmented-controls">
                {(['system', 'light', 'dark'] as const).map(mode => (
                  <button 
                    key={mode}
                    className={`asc-segment ${themeMode === mode ? 'active' : ''}`}
                    onClick={() => onThemeModeChange(mode)}
                  >
                    {mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'}
                  </button>
                ))}
              </div>
            </div>

            <div className="asc-section">
              <div className="asc-label">{t('settings.theme_color') || '种子主题色'}</div>
              <div className="asc-color-wrap">
                <button 
                  className={`asc-color-preset ${seedColor === '#9AD4EA' ? 'active' : ''}`}
                  style={{ backgroundColor: '#9AD4EA' }}
                  onClick={() => onSeedColorChange('#9AD4EA')}
                >
                  {seedColor === '#9AD4EA' && <span className="asc-color-check">✓</span>}
                </button>
                <button 
                  className={`asc-color-custom ${seedColor !== '#9AD4EA' ? 'active' : ''}`}
                  onClick={openColorPicker}
                >
                  {seedColor !== '#9AD4EA' ? (
                     <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: seedColor }} />
                  ) : '+'}
                </button>
              </div>
            </div>

            <div className="asc-divider" />

            <div className="asc-section">
              <div className="asc-label">{t('settings.language') || '显示语言'}</div>
              <div className="asc-lang-wrap">
                {(['system', 'zh', 'zh-TW', 'en', 'ja'] as const).map(lang => (
                  <button
                    key={lang}
                    className={`asc-lang-chip ${language === lang ? 'active' : ''}`}
                    onClick={() => onLanguageChange(lang)}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showColorModal && (
        <div className="color-modal-overlay">
          <div className="color-modal-box">
            <h3 className="color-modal-title">{t('settings.custom_color') || '自定义颜色'}</h3>
            <div 
              className="color-modal-preview" 
              style={{ backgroundColor: previewColor, boxShadow: `0 4px 12px ${previewColor}80` }}
            />
            
            <div className="color-slider-row">
              <span className="color-slider-label">色相</span>
              <input type="range" min="0" max="360" value={hue} onChange={e => setHue(Number(e.target.value))} />
            </div>
            <div className="color-slider-row">
              <span className="color-slider-label">饱和</span>
              <input type="range" min="0" max="100" value={sat} onChange={e => setSat(Number(e.target.value))} />
            </div>
            <div className="color-slider-row">
              <span className="color-slider-label">明度</span>
              <input type="range" min="20" max="90" value={lit} onChange={e => setLit(Number(e.target.value))} />
            </div>

            <div className="color-modal-actions">
              <button className="color-modal-btn cancel" onClick={() => setShowColorModal(false)}>
                {t('common.cancel') || '取消'}
              </button>
              <button className="color-modal-btn save" onClick={saveColor}>
                {t('common.save') || '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
