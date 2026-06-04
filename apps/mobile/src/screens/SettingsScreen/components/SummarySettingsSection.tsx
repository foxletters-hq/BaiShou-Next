import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
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
import { useNativeTheme, useNativeToast, Input } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { resolveAppUiLanguage } from '../../../lib/device-locale'
import { SettingsGroupCard } from './SettingsGroupCard'

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
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()

  const [summaryConfig, setSummaryConfig] = useState<SummaryConfig>({})
  const [activeTab, setActiveTab] = useState<SummaryTemplateKey>('weekly')
  const [activePromptLocale, setActivePromptLocale] = useState<SummaryPromptLocale>('zh')
  const [localText, setLocalText] = useState('')
  const [generationLocale, setGenerationLocale] = useState<SummaryPromptLocale>('zh')
  const [monthlySummarySource, setMonthlySummarySource] = useState<'weeklies' | 'diaries'>(
    'weeklies'
  )
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
      const globalModels =
        (await services.settingsManager.get<{ monthlySummarySource?: 'weeklies' | 'diaries' }>(
          'global_models'
        )) || {}
      setMonthlySummarySource(globalModels.monthlySummarySource ?? 'weeklies')
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

  const persistMonthlySource = async (source: 'weeklies' | 'diaries') => {
    if (!services || !dbReady) return
    const globalModels =
      (await services.settingsManager.get<Record<string, unknown>>('global_models')) || {}
    await services.settingsManager.set('global_models', {
      ...globalModels,
      monthlySummarySource: source
    })
    setMonthlySummarySource(source)
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
    await persistMonthlySource(monthlySummarySource)
    setGenerationLocale(autoLocale)
    toast.showSuccess(t('settings.saved'))
  }

  const handleReset = async () => {
    const defaultText = getDefaultSummaryTemplate(activeTab, activePromptLocale)
    setLocalText(defaultText)
    const next = flushLocal(activePromptLocale, activeTab, defaultText)
    await persistConfig(next)
    toast.showSuccess(t('summary.reset_template_success'))
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
      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.monthly_summary_data_source')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.monthly_summary_data_source_desc')}
        </Text>
        <View style={[styles.sourceGroup, { backgroundColor: colors.bgApp }]}>
          {(['weeklies', 'diaries'] as const).map((source) => {
            const active = monthlySummarySource === source
            const labelKey =
              source === 'weeklies' ? 'settings.read_only_weeklies' : 'settings.read_all_diaries'
            return (
              <TouchableOpacity
                key={source}
                style={[styles.sourceBtn, active && { backgroundColor: colors.primary }]}
                onPress={() => void persistMonthlySource(source)}
              >
                <Text
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: active ? '600' : '400',
                    textAlign: 'center'
                  }}
                >
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.summary_ai_prompt_title')}
        </Text>
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
                  backgroundColor: activePromptLocale === lang.id ? colors.primary : 'transparent'
                },
                generationLocale === lang.id && styles.langChipGeneration
              ]}
              onPress={() => handlePromptLocaleChange(lang.id)}
            >
              <Text
                style={{
                  color:
                    activePromptLocale === lang.id ? colors.textOnPrimary : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: activePromptLocale === lang.id ? '600' : '400'
                }}
              >
                {t(lang.labelKey, lang.fallback)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.tabBar, { backgroundColor: colors.bgApp }]}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, active && { backgroundColor: colors.primary }]}
                onPress={() => handleTabChange(tab.id)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: active ? '600' : '400'
                  }}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Input
          value={localText}
          onChangeText={setLocalText}
          multiline
          textarea
          numberOfLines={14}
          placeholder={t('settings.summary_ai_prompt_hint')}
          style={{ minHeight: 220, lineHeight: 20 }}
          containerStyle={{ marginBottom: 16 }}
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
            <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
              {t('common.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </SettingsGroupCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sourceGroup: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 8,
    marginBottom: 4
  },
  sourceBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6
  },
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
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
    borderRadius: 8,
    marginBottom: 12
  },
  tabBtn: {
    flex: 1,
    minWidth: '22%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 6
  },
  tabIcon: { fontSize: 16 },
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
