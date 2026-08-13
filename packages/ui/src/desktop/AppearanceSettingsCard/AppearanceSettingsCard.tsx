import React, { useState, useEffect } from 'react'
import {
  APP_UI_LANGUAGE_ORDER,
  normalizeUiFontSizeLevel,
  UI_FONT_SIZE_LEVEL_DEFAULT,
  UI_FONT_SIZE_LEVEL_MAX,
  UI_FONT_SIZE_LEVEL_MIN,
  UI_FONT_SIZE_SCALES
} from '@baishou/shared'
import './AppearanceSettingsCard.css'
import { useTranslation } from 'react-i18next'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'
import { PRESET_THEME_COLORS, isPresetThemeColor } from '../../theme/preset-theme-colors'
import { MonitorSmartphone, Moon, Palette, Sun } from 'lucide-react'

export interface AppearanceSettingsProps {
  themeMode: 'system' | 'light' | 'dark'
  seedColor: string
  language?: string
  fontSizeLevel?: number
  onThemeModeChange: (mode: 'system' | 'light' | 'dark') => void
  onSeedColorChange: (color: string) => void
  onLanguageChange: (lang: string) => void
  onFontSizeLevelChange?: (level: number) => void
  embedded?: boolean
  isLast?: boolean
}

const FONT_SIZE_TICKS = Array.from(
  { length: UI_FONT_SIZE_LEVEL_MAX - UI_FONT_SIZE_LEVEL_MIN + 1 },
  (_, i) => i + UI_FONT_SIZE_LEVEL_MIN
)

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  seedColor,
  language = 'system',
  fontSizeLevel = UI_FONT_SIZE_LEVEL_DEFAULT,
  onThemeModeChange,
  onSeedColorChange,
  onLanguageChange,
  onFontSizeLevelChange,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const [showPicker, setShowPicker] = useState(false)
  const [localColor, setLocalColor] = useState(seedColor)
  const resolvedFontSizeLevel = normalizeUiFontSizeLevel(fontSizeLevel)

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
          ? t(
              'auto.packages.ui.src.desktop.AppearanceSettingsCard.AppearanceSettingsCard.L46',
              '简体中文'
            )
          : val === 'zh-TW'
            ? t(
                'auto.packages.ui.src.desktop.AppearanceSettingsCard.AppearanceSettingsCard.L48',
                '繁體中文'
              )
            : val === 'en'
              ? 'English'
              : t(
                  'auto.packages.ui.src.desktop.AppearanceSettingsCard.AppearanceSettingsCard.L51',
                  '日本語'
                )
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

  const fontSizeLabelForTick = (level: number) => {
    if (level === UI_FONT_SIZE_LEVEL_MIN) return t('settings.font_size_small', '小')
    if (level === UI_FONT_SIZE_LEVEL_DEFAULT) return t('settings.font_size_default', '默认')
    if (level === UI_FONT_SIZE_LEVEL_MAX) return t('settings.font_size_large', '大')
    return ''
  }

  const fontSizeLabelStyle = (level: number): React.CSSProperties => {
    const span = UI_FONT_SIZE_LEVEL_MAX - UI_FONT_SIZE_LEVEL_MIN
    const pct = span <= 0 ? 0 : ((level - UI_FONT_SIZE_LEVEL_MIN) / span) * 100
    const scale = UI_FONT_SIZE_SCALES[level] ?? 1
    const align =
      level === UI_FONT_SIZE_LEVEL_MIN
        ? 'left'
        : level === UI_FONT_SIZE_LEVEL_MAX
          ? 'right'
          : 'center'
    const transform =
      level === UI_FONT_SIZE_LEVEL_MIN
        ? 'translateY(-50%)'
        : level === UI_FONT_SIZE_LEVEL_MAX
          ? 'translate(-100%, -50%)'
          : 'translate(-50%, -50%)'
    return {
      left: `${pct}%`,
      transform,
      textAlign: align,
      fontSize: `${Math.round(12 * scale)}px`
    }
  }

  return (
    <div className="appearance-settings-wrapper">
      <SettingsExpansionTile
        embedded={embedded}
        isLast={isLast}
        icon={<Palette size={20} />}
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
              <MonitorSmartphone
                size={16}
                style={{ marginRight: 6, verticalAlign: 'text-bottom' }}
              />
              {t('settings.theme_system', '系统跟随')}
            </button>
            <button
              className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`}
              onClick={() => onThemeModeChange('light')}
            >
              <Sun size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {t('settings.theme_light', '日间清晰')}
            </button>
            <button
              className={`theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => onThemeModeChange('dark')}
            >
              <Moon size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
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

        {onFontSizeLevelChange ? (
          <>
            <div className="appearance-row divider-row">
              <div className="settings-list-divider indent" />
            </div>

            <div className="appearance-row font-size-row">
              <label className="settings-label" htmlFor="appearance-font-size">
                {t('settings.font_size', '字体大小')}
              </label>
              <div className="font-size-slider">
                <input
                  id="appearance-font-size"
                  type="range"
                  className="font-size-range"
                  min={UI_FONT_SIZE_LEVEL_MIN}
                  max={UI_FONT_SIZE_LEVEL_MAX}
                  step={1}
                  value={resolvedFontSizeLevel}
                  aria-valuemin={UI_FONT_SIZE_LEVEL_MIN}
                  aria-valuemax={UI_FONT_SIZE_LEVEL_MAX}
                  aria-valuenow={resolvedFontSizeLevel}
                  aria-label={t('settings.font_size', '字体大小')}
                  onChange={(e) =>
                    onFontSizeLevelChange(normalizeUiFontSizeLevel(Number(e.target.value)))
                  }
                />
                <div className="font-size-ticks" aria-hidden="true">
                  {FONT_SIZE_TICKS.map((level) => (
                    <span key={level} className="font-size-tick" />
                  ))}
                </div>
                <div className="font-size-labels" aria-hidden="true">
                  {FONT_SIZE_TICKS.filter((level) => fontSizeLabelForTick(level)).map((level) => (
                    <span
                      key={level}
                      className={`font-size-label${level === resolvedFontSizeLevel ? ' active' : ''}`}
                      style={fontSizeLabelStyle(level)}
                    >
                      {fontSizeLabelForTick(level)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </SettingsExpansionTile>
    </div>
  )
}
