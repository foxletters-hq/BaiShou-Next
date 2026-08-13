import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Palette } from 'lucide-react-native'
import {
  APP_UI_LANGUAGE_ORDER,
  normalizeUiFontSizeLevel,
  UI_FONT_SIZE_LEVEL_DEFAULT,
  UI_FONT_SIZE_LEVEL_MAX,
  UI_FONT_SIZE_LEVEL_MIN,
  UI_FONT_SIZE_SCALES
} from '@baishou/shared'
import { Text, TouchableOpacity, View } from 'react-native'
import { useNativeTheme } from '../theme'
import type { AppearanceSettingsProps } from './appearance-settings.types'
import { PRESET_THEME_COLORS, isPresetThemeColor } from '../../theme/preset-theme-colors'
import { appearanceSettingsStyles as styles } from './appearance-settings.styles'
import { AppearanceSettingsColorModal } from './AppearanceSettingsColorModal'
import { CustomThemeColorDot } from './CustomThemeColorDot'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { NativeSlider } from '../Slider'
import { DEFAULT_STROKE_WIDTH, NAV_ICON_SIZE } from '../../shared/icons/icon-sizes'

const FONT_SIZE_TICKS = Array.from(
  { length: UI_FONT_SIZE_LEVEL_MAX - UI_FONT_SIZE_LEVEL_MIN + 1 },
  (_, i) => i + UI_FONT_SIZE_LEVEL_MIN
)

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  seedColor,
  language,
  fontSizeLevel = UI_FONT_SIZE_LEVEL_DEFAULT,
  onThemeModeChange,
  onSeedColorChange,
  onLanguageChange,
  onFontSizeLevelChange,
  embedded = false,
  isLast = false
}) => {
  const { t, i18n } = useTranslation()
  const { colors } = useNativeTheme()
  const [showColorModal, setShowColorModal] = useState(false)
  /** 点击后立刻切选中态，避免等父组件异步回写期间框停在旧项 */
  const [selectedLanguage, setSelectedLanguage] = useState(language)
  const resolvedFontSizeLevel = normalizeUiFontSizeLevel(fontSizeLevel)
  const [draftFontSizeLevel, setDraftFontSizeLevel] = useState(resolvedFontSizeLevel)

  useEffect(() => {
    console.log('[AppearanceLang] card:prop', {
      language,
      i18n: i18n.language
    })
    setSelectedLanguage(language)
  }, [language])

  useEffect(() => {
    setDraftFontSizeLevel(resolvedFontSizeLevel)
  }, [resolvedFontSizeLevel])

  const languageOptions = useMemo(
    () => [
      { val: 'system' as const, label: t('settings.language_system', '跟随系统') },
      ...APP_UI_LANGUAGE_ORDER.map((val) => ({
        val,
        label:
          val === 'zh'
            ? t(
                'auto.packages.ui.src.native.AppearanceSettingsCard.AppearanceSettingsCard.L36',
                '简体中文'
              )
            : val === 'zh-TW'
              ? t(
                  'auto.packages.ui.src.native.AppearanceSettingsCard.AppearanceSettingsCard.L38',
                  '繁體中文'
                )
              : val === 'en'
                ? 'English'
                : t(
                    'auto.packages.ui.src.native.AppearanceSettingsCard.AppearanceSettingsCard.L41',
                    '日本語'
                  )
      }))
    ],
    [t]
  )

  const isCustomColor = !isPresetThemeColor(seedColor)

  const openColorPicker = () => {
    setShowColorModal(true)
  }

  const fontSizeLabelForTick = (level: number) => {
    if (level === UI_FONT_SIZE_LEVEL_MIN) return t('settings.font_size_small', '小')
    if (level === UI_FONT_SIZE_LEVEL_DEFAULT) return t('settings.font_size_default', '默认')
    if (level === UI_FONT_SIZE_LEVEL_MAX) return t('settings.font_size_large', '大')
    return ''
  }

  const fontSizeTickLeftPct = (level: number) => {
    const span = UI_FONT_SIZE_LEVEL_MAX - UI_FONT_SIZE_LEVEL_MIN
    if (span <= 0) return '0%'
    return `${((level - UI_FONT_SIZE_LEVEL_MIN) / span) * 100}%`
  }

  const content = (
    <>
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        {t('settings.theme_mode', '主题模式')}
      </Text>
      <View style={[styles.segmentedControl, { borderColor: colors.borderMuted }]}>
        {(['system', 'light', 'dark'] as const).map((mode, index) => (
          <TouchableOpacity
            key={mode}
            activeOpacity={0.6}
            style={[
              styles.segmentBtn,
              { borderRightColor: colors.borderMuted },
              themeMode === mode && {
                backgroundColor: colors.primaryLight
              },
              index === 2 && { borderRightWidth: 0 }
            ]}
            onPress={() => onThemeModeChange(mode)}
          >
            <Text
              style={[
                styles.segmentText,
                { color: colors.textPrimary },
                themeMode === mode && { fontWeight: '600' }
              ]}
            >
              {mode === 'system'
                ? t('settings.theme_system', '跟随系统')
                : mode === 'light'
                  ? t('settings.theme_light', '浅色')
                  : t('settings.theme_dark', '深色')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.textPrimary, marginTop: 16 }]}>
        {t('settings.theme_color', '基核种子色')}
      </Text>
      <View style={styles.colorPalette}>
        {PRESET_THEME_COLORS.map((c) => {
          const active = seedColor.toUpperCase() === c.toUpperCase()
          return (
            <TouchableOpacity
              key={c}
              activeOpacity={0.8}
              style={[
                styles.colorOption,
                { backgroundColor: c },
                active && { borderWidth: 2, borderColor: colors.textPrimary }
              ]}
              onPress={() => onSeedColorChange(c)}
            >
              {active ? (
                <Text style={[styles.checkIcon, { color: colors.textOnPrimary }]}>✓</Text>
              ) : null}
            </TouchableOpacity>
          )
        })}
        <CustomThemeColorDot
          isCustom={isCustomColor}
          seedColor={seedColor}
          active={isCustomColor}
          onPress={openColorPicker}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

      <Text style={[styles.label, { color: colors.textPrimary }]}>
        {t('settings.language', '显示语言')}
      </Text>
      <View style={styles.langWrap}>
        {languageOptions.map((lang) => {
          const active = selectedLanguage === lang.val
          return (
            <TouchableOpacity
              key={lang.val}
              activeOpacity={0.6}
              style={[
                styles.langChip,
                { borderColor: colors.borderMuted },
                active && {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primary
                }
              ]}
              onPress={() => {
                console.log('[AppearanceLang] card:press', {
                  from: selectedLanguage,
                  to: lang.val,
                  prop: language,
                  i18n: i18n.language
                })
                setSelectedLanguage(lang.val)
                onLanguageChange(lang.val)
              }}
            >
              <Text
                style={[
                  styles.langText,
                  { color: colors.textPrimary },
                  active && { fontWeight: '600', color: colors.primary }
                ]}
              >
                {lang.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {onFontSizeLevelChange ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.fontSizeBlock}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('settings.font_size', '字体大小')}
            </Text>
            <View style={styles.fontSizeSliderWrap}>
              <NativeSlider
                value={draftFontSizeLevel}
                minValue={UI_FONT_SIZE_LEVEL_MIN}
                maxValue={UI_FONT_SIZE_LEVEL_MAX}
                step={1}
                commitOnChangeEnd
                onChange={(next) => setDraftFontSizeLevel(normalizeUiFontSizeLevel(next))}
                onChangeEnd={(next) => {
                  const level = normalizeUiFontSizeLevel(next)
                  setDraftFontSizeLevel(level)
                  onFontSizeLevelChange(level)
                }}
              />
            </View>
            <View style={styles.fontSizeTicks} pointerEvents="none">
              {FONT_SIZE_TICKS.map((level) => (
                <View
                  key={level}
                  style={[
                    styles.fontSizeTick,
                    {
                      left: fontSizeTickLeftPct(level),
                      backgroundColor: colors.borderMuted
                    }
                  ]}
                />
              ))}
            </View>
            <View style={styles.fontSizeLabels} pointerEvents="none">
              {FONT_SIZE_TICKS.filter((level) => fontSizeLabelForTick(level)).map((level) => {
                const scale = UI_FONT_SIZE_SCALES[level] ?? 1
                const isFirst = level === UI_FONT_SIZE_LEVEL_MIN
                const isLast = level === UI_FONT_SIZE_LEVEL_MAX
                const labelWidth = 48
                return (
                  <View
                    key={level}
                    style={[
                      styles.fontSizeLabel,
                      {
                        left: fontSizeTickLeftPct(level),
                        width: labelWidth,
                        marginLeft: isFirst ? 0 : isLast ? -labelWidth : -labelWidth / 2,
                        alignItems: isFirst ? 'flex-start' : isLast ? 'flex-end' : 'center'
                      }
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: Math.round(12 * scale),
                        color:
                          level === draftFontSizeLevel
                            ? colors.textPrimary
                            : colors.textSecondary,
                        fontWeight: level === draftFontSizeLevel ? '500' : '400'
                      }}
                    >
                      {fontSizeLabelForTick(level)}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        </>
      ) : null}

      <AppearanceSettingsColorModal
        visible={showColorModal}
        initialColor={seedColor}
        onClose={() => setShowColorModal(false)}
        onSave={(color) => {
          onSeedColorChange(color)
          setShowColorModal(false)
        }}
      />
    </>
  )

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      icon={
        <Palette
          size={NAV_ICON_SIZE}
          strokeWidth={DEFAULT_STROKE_WIDTH}
          color={colors.textSecondary}
        />
      }
      title={t('settings.appearance', '外观与多语言')}
      subtitle={embedded ? undefined : `${themeMode} · ${selectedLanguage}`}
    >
      {content}
    </SettingsExpansionTile>
  )
}
