import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutAnimation } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { WebSearchConfig } from '@baishou/shared'
import { Switch, useNativeTheme, Input } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { SettingsGroupCard } from './SettingsGroupCard'
import { SettingsSliderRow } from './SettingsSliderRow'

const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  webSearchEngine: 'exa-mcp',
  webSearchMaxResults: 5,
  webSearchRagEnabled: false,
  tavilyApiKey: '',
  exaApiKey: '',
  anysearchApiKey: '',
  webSearchRagMaxChunks: 12,
  webSearchRagChunksPerSource: 4,
  webSearchPlainSnippetLength: 3000
}

const ENGINES: Array<{ id: WebSearchConfig['webSearchEngine']; labelKey: string }> = [
  { id: 'duckduckgo', labelKey: 'settings.web_search_engine_duckduckgo' },
  { id: 'tavily', labelKey: 'settings.web_search_engine_tavily' },
  { id: 'exa', labelKey: 'settings.web_search_engine_exa' },
  { id: 'exa-mcp', labelKey: 'settings.web_search_engine_exa_mcp' },
  { id: 'anysearch', labelKey: 'settings.web_search_engine_anysearch' }
]

export const WebSearchSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const [config, setConfig] = useState<WebSearchConfig>(DEFAULT_WEB_SEARCH_CONFIG)

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved =
        (await services.settingsManager.get<WebSearchConfig>('web_search_config')) ??
        DEFAULT_WEB_SEARCH_CONFIG
      setConfig({ ...DEFAULT_WEB_SEARCH_CONFIG, ...saved })
    })()
  }, [dbReady, services])

  const applyPatch = useCallback(
    (partial: Partial<WebSearchConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...partial }
        if (services && dbReady) {
          void services.settingsManager.set('web_search_config', next)
        }
        return next
      })
    },
    [services, dbReady]
  )

  const handleRagToggle = (enabled: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    applyPatch({ webSearchRagEnabled: enabled })
  }

  const ragOn = config.webSearchRagEnabled

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.web_search_config_title')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.web_search_config_desc')}
        </Text>

        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('agent.tools.param_search_engine')}
        </Text>
        <View style={styles.chipRow}>
          {ENGINES.map((engine) => {
            const active = config.webSearchEngine === engine.id
            return (
              <TouchableOpacity
                key={engine.id}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.primary : colors.borderMuted,
                    backgroundColor: active ? colors.primaryLight : 'transparent'
                  }
                ]}
                onPress={() => applyPatch({ webSearchEngine: engine.id })}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.textSecondary,
                    fontWeight: active ? '600' : '400'
                  }}
                >
                  {t(engine.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {config.webSearchEngine === 'tavily' && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.tools.param_tavily_api_key')}
            </Text>
            <Text style={[styles.hint, { color: colors.textTertiary, marginBottom: 6 }]}>
              {t('agent.tools.param_tavily_api_key_desc')}
            </Text>
            <Input
              value={config.tavilyApiKey}
              onChangeText={(v) => applyPatch({ tavilyApiKey: v })}
              placeholder={t('agent.tools.param_tavily_api_key')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              containerStyle={{ marginTop: 8 }}
            />
          </>
        )}

        {config.webSearchEngine === 'exa' && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.tools.param_exa_api_key')}
            </Text>
            <Text style={[styles.hint, { color: colors.textTertiary, marginBottom: 6 }]}>
              {t('agent.tools.param_exa_api_key_desc')}
            </Text>
            <Input
              value={config.exaApiKey}
              onChangeText={(v) => applyPatch({ exaApiKey: v })}
              placeholder={t('agent.tools.param_exa_api_key')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              containerStyle={{ marginTop: 8 }}
            />
          </>
        )}

        {config.webSearchEngine === 'anysearch' && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.tools.param_anysearch_api_key')}
            </Text>
            <Text style={[styles.hint, { color: colors.textTertiary, marginBottom: 6 }]}>
              {t('agent.tools.param_anysearch_api_key_desc')}
            </Text>
            <Input
              value={config.anysearchApiKey}
              onChangeText={(v) => applyPatch({ anysearchApiKey: v })}
              placeholder={t('agent.tools.param_anysearch_api_key')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              containerStyle={{ marginTop: 8 }}
            />
          </>
        )}

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <SettingsSliderRow
          title={t('agent.tools.param_max_results')}
          description={t('agent.tools.param_max_results_desc')}
          value={config.webSearchMaxResults}
          min={1}
          max={30}
          step={1}
          onChange={(v) => applyPatch({ webSearchMaxResults: v })}
        />

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.tools.param_rag_enabled')}
            </Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              {t('agent.tools.param_rag_enabled_desc')}
            </Text>
          </View>
          <Switch value={ragOn} onValueChange={handleRagToggle} />
        </View>

        <View style={ragOn ? undefined : styles.collapsed} pointerEvents={ragOn ? 'auto' : 'none'}>
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsSliderRow
            title={t('agent.tools.param_rag_max_chunks')}
            description={t('agent.tools.param_rag_max_chunks_desc')}
            value={config.webSearchRagMaxChunks}
            min={1}
            max={50}
            step={1}
            onChange={(v) => applyPatch({ webSearchRagMaxChunks: v })}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsSliderRow
            title={t('agent.tools.param_rag_chunks_per_source')}
            description={t('agent.tools.param_rag_chunks_per_source_desc')}
            value={config.webSearchRagChunksPerSource}
            min={1}
            max={20}
            step={1}
            onChange={(v) => applyPatch({ webSearchRagChunksPerSource: v })}
          />
        </View>

        <View style={ragOn ? styles.collapsed : undefined} pointerEvents={ragOn ? 'none' : 'auto'}>
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsSliderRow
            title={t('agent.tools.param_plain_snippet_length')}
            description={t('agent.tools.param_plain_snippet_length_desc')}
            value={config.webSearchPlainSnippetLength}
            min={500}
            max={30000}
            step={100}
            onChange={(v) => applyPatch({ webSearchPlainSnippetLength: v })}
          />
        </View>

        <View style={{ height: tokens.spacing.xs }} />
      </SettingsGroupCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  divider: { height: 1, marginVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  collapsed: {
    height: 0,
    overflow: 'hidden',
    opacity: 0
  }
})
