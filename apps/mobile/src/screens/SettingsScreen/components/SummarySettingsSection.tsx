import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  getDefaultSummaryTemplate,
  getSummaryTemplateForEdit,
  resolveSummaryPromptLocale,
  SUMMARY_PROMPT_LOCALE_OPTIONS,
  type SummaryConfig,
  type SummaryPromptLocale,
  type SummaryTemplateKey
} from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { resolveAppUiLanguage } from '../../../lib/device-locale'

const TEMPLATE_KEYS: SummaryTemplateKey[] = ['weekly', 'monthly', 'quarterly', 'yearly']

const TAB_META: Record<SummaryTemplateKey, { icon: string; labelKey: string }> = {
  weekly: { icon: '🌱', labelKey: 'summary.tab_weekly' },
  monthly: { icon: '☘️', labelKey: 'summary.tab_monthly' },
  quarterly: { icon: '🪴', labelKey: 'summary.tab_quarterly' },
  yearly: { icon: '🌳', labelKey: 'summary.tab_yearly' }
}

export const SummarySettingsSection: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [summaryConfig, setSummaryConfig] = useState<SummaryConfig>({})
  const [activeTab, setActiveTab] = useState<SummaryTemplateKey>('weekly')
  const [activePromptLocale, setActivePromptLocale] = useState<SummaryPromptLocale>('zh')
  const [localText, setLocalText] = useState('')
  const [generationLocale, setGenerationLocale] = useState<SummaryPromptLocale>('zh')
  const activeTabRef = useRef<SummaryTemplateKey>(activeTab)
  activeTabRef.current = activeTab

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved = (await services.settingsManager.get<SummaryConfig>('summary_config')) || {}
      const settings = (await services.settingsManager.get<{ language?: string }>('settings')) || {}
      const uiLang = resolveAppUiLanguage(settings.language, i18n.language)
      const autoLocale = resolveSummaryPromptLocale(uiLang)
      setSummaryConfig(saved)
      setGenerationLocale(autoLocale)
      setActivePromptLocale(autoLocale)
      setLocalText(
        getSummaryTemplateForEdit(saved.instructionsByLocale ?? {}, autoLocale, 'weekly')
      )
    })()
  }, [dbReady, services])

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved = (await services.settingsManager.get<SummaryConfig>('summary_config')) || {}
      const settings = (await services.settingsManager.get<{ language?: string }>('settings')) || {}
      const uiLang = resolveAppUiLanguage(settings.language, i18n.language)
      const autoLocale = resolveSummaryPromptLocale(uiLang)
      setGenerationLocale(autoLocale)
      setActivePromptLocale(autoLocale)
      setLocalText(
        getSummaryTemplateForEdit(
          saved.instructionsByLocale ?? {},
          autoLocale,
          activeTabRef.current
        )
      )
    })()
  }, [dbReady, i18n.language, services])

  const readTemplate = useCallback(
    (locale: SummaryPromptLocale, type: SummaryTemplateKey) =>
      getSummaryTemplateForEdit(summaryConfig.instructionsByLocale ?? {}, locale, type),
    [summaryConfig.instructionsByLocale]
  )

  const patchLocaleTemplates = useCallback(
    (locale: SummaryPromptLocale, type: SummaryTemplateKey, text: string) => ({
      ...(summaryConfig.instructionsByLocale || {}),
      [locale]: {
        ...(summaryConfig.instructionsByLocale?.[locale] || {}),
        [type]: text
      }
    }),
    [summaryConfig.instructionsByLocale]
  )

  const persistConfig = async (next: SummaryConfig) => {
    if (!services || !dbReady) return
    await services.settingsManager.set('summary_config', next)
    setSummaryConfig(next)
  }

  const flushLocal = (locale: SummaryPromptLocale, type: SummaryTemplateKey, text: string) => ({
    ...summaryConfig,
    promptLocale: generationLocale,
    instructionsByLocale: patchLocaleTemplates(locale, type, text)
  })

  const handleTabChange = (tab: SummaryTemplateKey) => {
    const merged = flushLocal(activePromptLocale, activeTab, localText)
    setSummaryConfig(merged)
    setActiveTab(tab)
    setLocalText(readTemplate(activePromptLocale, tab))
  }

  const handlePromptLocaleChange = (locale: SummaryPromptLocale) => {
    const merged = flushLocal(activePromptLocale, activeTab, localText)
    setSummaryConfig(merged)
    setActivePromptLocale(locale)
    setLocalText(getSummaryTemplateForEdit(merged.instructionsByLocale, locale, activeTab))
  }

  const handleSave = async () => {
    const settings = (await services?.settingsManager.get<{ language?: string }>('settings')) || {}
    const uiLang = resolveAppUiLanguage(settings.language, i18n.language)
    const autoLocale = resolveSummaryPromptLocale(uiLang)
    const next: SummaryConfig = {
      ...flushLocal(activePromptLocale, activeTab, localText),
      promptLocale: autoLocale
    }
    await persistConfig(next)
    setGenerationLocale(autoLocale)
    Alert.alert(t('common.success'), t('settings.saved'))
  }

  const handleReset = async () => {
    const defaultText = getDefaultSummaryTemplate(activeTab, activePromptLocale)
    setLocalText(defaultText)
    const next = flushLocal(activePromptLocale, activeTab, defaultText)
    await persistConfig(next)
    Alert.alert(t('common.success'), t('summary.reset_template_success'))
  }

  const tabs = useMemo(
    () =>
      TEMPLATE_KEYS.map((id) => ({
        id,
        icon: TAB_META[id].icon,
        label: t(TAB_META[id].labelKey)
      })),
    [t]
  )

  const generationLabel =
    SUMMARY_PROMPT_LOCALE_OPTIONS.find((l) => l.id === generationLocale)?.fallback ??
    generationLocale

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        {t('settings.summary_ai_prompt_desc')}
      </Text>

      <Text style={[styles.localeHint, { color: colors.textSecondary }]}>
        {t('settings.summary_prompt_locale_hint')}:{' '}
        <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{generationLabel}</Text>
      </Text>

      <View style={styles.langBar}>
        {SUMMARY_PROMPT_LOCALE_OPTIONS.map((lang) => (
          <TouchableOpacity
            key={lang.id}
            style={[
              styles.langChip,
              {
                borderColor: activePromptLocale === lang.id ? colors.primary : colors.borderMuted,
                backgroundColor:
                  activePromptLocale === lang.id ? colors.primaryLight : 'transparent'
              },
              generationLocale === lang.id && styles.langChipGeneration
            ]}
            onPress={() => handlePromptLocaleChange(lang.id)}
          >
            <Text
              style={{
                color: activePromptLocale === lang.id ? colors.primary : colors.textSecondary,
                fontSize: 13
              }}
            >
              {t(lang.labelKey, lang.fallback)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabBtn,
              {
                borderColor: activeTab === tab.id ? colors.primary : colors.borderMuted,
                backgroundColor: activeTab === tab.id ? colors.primaryLight : colors.bgSurfaceHighest
              }
            ]}
            onPress={() => handleTabChange(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={{
                color: activeTab === tab.id ? colors.primary : colors.textSecondary,
                fontSize: 12,
                fontWeight: activeTab === tab.id ? '600' : '400'
              }}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={[
          styles.editor,
          {
            backgroundColor: colors.bgSurfaceHighest,
            color: colors.textPrimary,
            borderColor: colors.borderMuted
          }
        ]}
        value={localText}
        onChangeText={setLocalText}
        multiline
        numberOfLines={14}
        textAlignVertical="top"
        placeholder={t('settings.summary_ai_prompt_hint')}
        placeholderTextColor={colors.textTertiary}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { borderColor: colors.borderSubtle }]}
          onPress={() => void handleReset()}
        >
          <Text style={{ color: colors.textSecondary }}>{t('settings.restore_default')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={() => void handleSave()}
        >
          <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  localeHint: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  langBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  langChipGeneration: {
    borderStyle: 'dashed'
  },
  tabBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: '48%'
  },
  tabIcon: { fontSize: 16 },
  editor: {
    minHeight: 220,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16
  },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  saveBtn: { borderWidth: 0 }
})
