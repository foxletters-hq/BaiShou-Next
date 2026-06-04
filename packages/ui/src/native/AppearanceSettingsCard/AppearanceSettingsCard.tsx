import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { APP_UI_LANGUAGE_ORDER } from '@baishou/shared'
import { Text, TouchableOpacity, View } from 'react-native'
import { useNativeTheme } from '../theme'
import type { AppearanceSettingsProps } from './appearance-settings.types'
import { PRESET_THEME_COLORS, isPresetThemeColor } from '../../theme/preset-theme-colors'
import { hslToHex } from './appearance-color.utils'
import { appearanceSettingsStyles as styles } from './appearance-settings.styles'
import { AppearanceSettingsColorModal } from './AppearanceSettingsColorModal'
import { CustomThemeColorDot } from './CustomThemeColorDot'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  seedColor,
  language,
  onThemeModeChange,
  onSeedColorChange,
  onLanguageChange,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [showColorModal, setShowColorModal] = useState(false)
  const [hue, setHue] = useState(0)
  const [sat, setSat] = useState(100)
  const [lit, setLit] = useState(50)

  const previewColor = hslToHex(hue, sat, lit)

  const languageOptions = useMemo(
    () => [
      { val: 'system' as const, label: t('settings.language_system', '跟随系统') },
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
    ],
    [t]
  )

  const isCustomColor = !isPresetThemeColor(seedColor)

  const openColorPicker = () => {
    setHue(190)
    setSat(60)
    setLit(75)
    setShowColorModal(true)
  }

  const saveColor = () => {
    onSeedColorChange(previewColor)
    setShowColorModal(false)
  }

  const content = (
    <>
      <View style={[styles.divider, { backgroundColor: colors.borderSubtle, marginTop: 0 }]} />

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
                themeMode === mode && { fontWeight: 'bold' }
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
        {languageOptions.map((lang) => (
          <TouchableOpacity
            key={lang.val}
            activeOpacity={0.6}
            style={[
              styles.langChip,
              { borderColor: colors.borderMuted },
              language === lang.val && {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primary
              }
            ]}
            onPress={() => onLanguageChange(lang.val)}
          >
            <Text
              style={[
                styles.langText,
                { color: colors.textPrimary },
                language === lang.val && { fontWeight: 'bold' }
              ]}
            >
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <AppearanceSettingsColorModal
        visible={showColorModal}
        previewColor={previewColor}
        hue={hue}
        sat={sat}
        lit={lit}
        onHueChange={setHue}
        onSatChange={setSat}
        onLitChange={setLit}
        onClose={() => setShowColorModal(false)}
        onSave={saveColor}
      />
    </>
  )

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('settings.appearance', '外观与多语言')}
      subtitle={embedded ? undefined : `${themeMode} · ${language}`}
    >
      {content}
    </SettingsExpansionTile>
  )
}
