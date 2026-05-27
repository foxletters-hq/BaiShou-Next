import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  UIManager,
  LayoutAnimation
} from 'react-native'
import { useNativeTheme } from '../theme'
import type { AppearanceSettingsProps } from './appearance-settings.types'
import { hslToHex } from './appearance-color.utils'
import { appearanceSettingsStyles as styles } from './appearance-settings.styles'
import { AppearanceSettingsColorModal } from './AppearanceSettingsColorModal'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  seedColor,
  language,
  onThemeModeChange,
  onSeedColorChange,
  onLanguageChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [expanded, setExpanded] = useState(false)
  const [showColorModal, setShowColorModal] = useState(false)
  const [hue, setHue] = useState(0)
  const [sat, setSat] = useState(100)
  const [lit, setLit] = useState(50)

  const previewColor = hslToHex(hue, sat, lit)

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(!expanded)
  }

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

  return (
    <View
      style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }]}
    >
      <TouchableOpacity style={styles.header} onPress={toggleExpand} activeOpacity={0.7}>
        <Text style={styles.icon}>🎨</Text>
        <View style={styles.headerBody}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('settings.appearance', '外观与多语言')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {themeMode} · {language}
          </Text>
        </View>
        <Text
          style={[
            styles.arrow,
            {
              color: colors.textSecondary,
              transform: [{ rotate: expanded ? '180deg' : '0deg' }]
            }
          ]}
        >
          ▼
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
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
            {t('settings.theme_color', '种子主题色')}
          </Text>
          <View style={styles.colorWrap}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.colorOption,
                { backgroundColor: '#9AD4EA' },
                seedColor === '#9AD4EA' && {
                  borderWidth: 2,
                  borderColor: colors.primary
                }
              ]}
              onPress={() => onSeedColorChange('#9AD4EA')}
            >
              {seedColor === '#9AD4EA' && (
                <Text style={[styles.checkIcon, { color: colors.textOnPrimary }]}>✓</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.customColorBtn,
                {
                  backgroundColor: colors.bgSurfaceHigh,
                  borderColor: colors.borderMuted
                },
                seedColor !== '#9AD4EA' && {
                  borderColor: colors.primary,
                  borderWidth: 2
                }
              ]}
              onPress={openColorPicker}
            >
              {seedColor !== '#9AD4EA' ? (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: seedColor
                  }}
                />
              ) : (
                <Text style={[styles.addIcon, { color: colors.textSecondary }]}>+</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('settings.language', '显示语言')}
          </Text>
          <View style={styles.langWrap}>
            {(['system', 'zh', 'zh-TW', 'en', 'ja'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                activeOpacity={0.6}
                style={[
                  styles.langChip,
                  { borderColor: colors.borderMuted },
                  language === lang && {
                    backgroundColor: colors.primaryLight,
                    borderColor: colors.primary
                  }
                ]}
                onPress={() => onLanguageChange(lang)}
              >
                <Text
                  style={[
                    styles.langText,
                    { color: colors.textPrimary },
                    language === lang && { fontWeight: 'bold' }
                  ]}
                >
                  {lang}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
    </View>
  )
}
