import React, { useState, useEffect } from 'react'
import { APP_UI_LANGUAGE_ORDER } from '@baishou/shared'
import './AppearanceSettingsCard.css'
import { useTranslation } from 'react-i18next'
import { MdOutlinePalette, MdDevices, MdWbSunny, MdDarkMode } from 'react-icons/md'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'
import { PRESET_THEME_COLORS, isPresetThemeColor } from '../../theme/preset-theme-colors'

export interface AppearanceSettingsProps {
  themeMode: 'system' | 'light' | 'dark'
  seedColor: string
  language?: string
  onThemeModeChange: (mode: 'system' | 'light' | 'dark') => void
  onSeedColorChange: (color: string) => void
  onLanguageChange: (lang: string) => void
}

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  seedColor,
  language = 'system',
  onThemeModeChange,
  onSeedColorChange,
  onLanguageChange
}) => {
  const { t } = useTranslation()
  const [showPicker, setShowPicker] = useState(false)
  const [localColor, setLocalColor] = useState(seedColor)

  useEffect(() => {
    setLocalColor(seedColor)
  }, [seedColor])

  const isCustomColor = !isPresetThemeColor(seedColor)

  const LANGS = [
    { val: 'system', label: t('settings.language_system', '跟随系统') },
    ...APP_UI_LANGUAGE_ORDER.map((val) => ({
      val,
      label:
        val === 'zh'
          ? '简体中文'
          : val === 'zh-TW'
            ? '繁體中文'
            : val === 'en'
              ? 'English'
              : '日本語'
    }))
  ]

  const getThemeText = () => {
    switch (themeMode) {
      case 'system':
        return t('settings.theme_system', '系统跟随')
      case 'light':
        return t('settings.theme_light', '日间清晰')
      case 'dark':
        return t('settings.theme_dark', '夜宴暗影')
    }
  }

  const getLangText = () => {
    return LANGS.find((l) => l.val === language)?.label || t('settings.language_system', '跟随系统')
  }

  return (
    <div className="appearance-settings-wrapper">
      <SettingsExpansionTile
        icon={<MdOutlinePalette size={24} />}
        title={t('settings.appearance', '外观与主题')}
        subtitle={`${getThemeText()} · ${getLangText()}`}
      >
        <div className="appearance-row">
          <label className="settings-label">{t('settings.theme_mode', '光照模式')}</label>
          <div className="theme-toggle-group">
            <button
              className={`theme-btn ${themeMode === 'system' ? 'active' : ''}`}
              onClick={() => onThemeModeChange('system')}
            >
              <MdDevices size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {t('settings.theme_system', '系统跟随')}
            </button>
            <button
              className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`}
              onClick={() => onThemeModeChange('light')}
            >
              <MdWbSunny size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {t('settings.theme_light', '日间清晰')}
            </button>
            <button
              className={`theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => onThemeModeChange('dark')}
            >
              <MdDarkMode size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {t('settings.theme_dark', '夜宴暗影')}
            </button>
          </div>
        </div>

        <div className="appearance-row">
          <label className="settings-label">{t('settings.theme_color', '基核种子色')}</label>
          <div className="color-palette">
            {PRESET_THEME_COLORS.map((c) => (
              <div
                key={c}
                className={`color-dot ${seedColor.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => onSeedColorChange(c)}
              >
                {seedColor.toUpperCase() === c.toUpperCase() && (
                  <span className="color-dot-check">✓</span>
                )}
              </div>
            ))}
            <div
              className={`color-dot custom-color-picker ${isCustomColor ? 'active' : ''}`}
              style={{
                background: isCustomColor
                  ? seedColor
                  : 'linear-gradient(45deg, #FF6B6B, #FFD93D, #4D96FF, #C77DFF)'
              }}
              onClick={() => setShowPicker(!showPicker)}
            >
              {isCustomColor ? <span className="color-dot-check">✓</span> : '+'}
            </div>

            {showPicker && (
              <div className="color-native-wrapper">
                <input
                  type="color"
                  value={localColor}
                  onChange={(e) => setLocalColor(e.target.value)}
                  onBlur={() => {
                    onSeedColorChange(localColor)
                    setShowPicker(false)
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="appearance-row divider-row">
          <div className="settings-list-divider indent" />
        </div>

        <div className="appearance-row" style={{ marginTop: '8px' }}>
          <label className="settings-label">{t('settings.language', '界译语言')}</label>
          <div className="lang-chips">
            {LANGS.map((l) => (
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
      </SettingsExpansionTile>
    </div>
  )
}
