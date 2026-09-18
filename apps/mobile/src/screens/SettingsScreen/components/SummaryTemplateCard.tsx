import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  SUMMARY_PROMPT_LOCALE_OPTIONS,
  type SummaryPromptLocale,
  type SummaryTemplateKey
} from '@baishou/shared'
import { Input, useNativeTheme } from '@baishou/ui/native'
import { SettingsGroupCard } from './SettingsGroupCard'
import { SummaryPromptLocaleBar } from './SummaryPromptLocaleBar'
import { summarySettingsStyles as styles } from './summary-settings.styles'

export function SummaryTemplateCard(props: {
  monthlySummarySource: 'weeklies' | 'diaries'
  persistAutoSettings: (overrides: { monthlySummarySource?: 'weeklies' | 'diaries' }) => void
  generationLocale: SummaryPromptLocale
  activePromptLocale: SummaryPromptLocale
  onPromptLocaleChange: (locale: SummaryPromptLocale) => void
  tabs: Array<{ id: SummaryTemplateKey; icon: string; label: string }>
  activeTab: SummaryTemplateKey
  onTabChange: (tab: SummaryTemplateKey) => void
  localText: string
  onLocalText: (text: string) => void
  onReset: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const {
    monthlySummarySource,
    persistAutoSettings,
    generationLocale,
    activePromptLocale,
    onPromptLocaleChange,
    tabs,
    activeTab,
    onTabChange,
    localText,
    onLocalText,
    onReset,
    onSave
  } = props
  const generationLabel =
    SUMMARY_PROMPT_LOCALE_OPTIONS.find((l) => l.id === generationLocale)?.fallback ??
    generationLocale

  return (
    <>
      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.summary_data_sources_title')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.summary_data_sources_desc')}
        </Text>
        <Text style={[styles.dataSourceLine, { color: colors.textSecondary }]}>
          {t('settings.summary_data_source_weekly')}
        </Text>
        <Text style={[styles.dataSourceLine, { color: colors.textSecondary }]}>
          {t('settings.summary_data_source_monthly')}
        </Text>
        <Text style={[styles.dataSourceLine, { color: colors.textSecondary }]}>
          {t('settings.summary_data_source_quarterly')}
        </Text>
        <Text style={[styles.dataSourceLine, { color: colors.textSecondary }]}>
          {t('settings.summary_data_source_yearly')}
        </Text>

        <Text style={[styles.cardTitle, { color: colors.textPrimary, marginTop: 12 }]}>
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
                onPress={() => persistAutoSettings({ monthlySummarySource: source })}
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
          {t('settings.summary_generation_templates_title')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.summary_generation_templates_desc')}
        </Text>

        <Text style={[styles.localeHint, { color: colors.textSecondary }]}>
          {t('settings.summary_prompt_locale_hint')}:{' '}
          <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{generationLabel}</Text>
        </Text>

        <SummaryPromptLocaleBar
          activePromptLocale={activePromptLocale}
          generationLocale={generationLocale}
          onChange={onPromptLocaleChange}
        />

        <View style={[styles.tabBar, { backgroundColor: colors.bgApp }]}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, active && { backgroundColor: colors.primary }]}
                onPress={() => onTabChange(tab.id)}
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
          onChangeText={onLocalText}
          multiline
          textarea
          numberOfLines={14}
          placeholder={t('settings.summary_ai_prompt_hint')}
          style={{ minHeight: 220, lineHeight: 20 }}
          containerStyle={{ marginBottom: 16 }}
        />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, { borderColor: colors.borderControl }]}
            onPress={() => void onReset()}
          >
            <Text style={{ color: colors.textSecondary }}>{t('settings.restore_default')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={() => void onSave()}
          >
            <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
              {t('common.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </SettingsGroupCard>
    </>
  )
}
