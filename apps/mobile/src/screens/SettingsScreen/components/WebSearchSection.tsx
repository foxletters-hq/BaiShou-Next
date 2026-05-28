import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native'
import Slider from '@react-native-community/slider'
import { useTranslation } from 'react-i18next'
import type { WebSearchConfig } from '@baishou/shared'
import { SettingsSection, Switch, useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  webSearchEngine: 'duckduckgo',
  webSearchMaxResults: 5,
  webSearchRagEnabled: false,
  tavilyApiKey: '',
  webSearchRagMaxChunks: 12,
  webSearchRagChunksPerSource: 4,
  webSearchPlainSnippetLength: 3000
}

const ENGINES: Array<{ id: WebSearchConfig['webSearchEngine']; labelKey: string }> = [
  { id: 'duckduckgo', labelKey: 'settings.web_search_engine_duckduckgo' },
  { id: 'tavily', labelKey: 'settings.web_search_engine_tavily' }
]

interface SliderRowProps {
  title: string
  description?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

const SliderRow: React.FC<SliderRowProps> = ({
  title,
  description,
  value,
  min,
  max,
  step,
  onChange
}) => {
  const { colors } = useNativeTheme()
  return (
    <View style={sliderStyles.block}>
      <View style={sliderStyles.header}>
        <View style={sliderStyles.textGroup}>
          <Text style={[sliderStyles.title, { color: colors.textPrimary }]}>{title}</Text>
          {description ? (
            <Text style={[sliderStyles.desc, { color: colors.textTertiary }]}>{description}</Text>
          ) : null}
        </View>
        <Text style={[sliderStyles.value, { color: colors.primary }]}>{value}</Text>
      </View>
      <Slider
        style={sliderStyles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={(v) => onChange(Math.round(v))}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.borderMuted}
        thumbTintColor={colors.primary}
      />
    </View>
  )
}

const sliderStyles = StyleSheet.create({
  block: { marginBottom: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4
  },
  textGroup: { flex: 1 },
  title: { fontSize: 15, fontWeight: '500' },
  desc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  value: { fontSize: 16, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  slider: { width: '100%', height: 36 }
})

export const WebSearchSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const [config, setConfig] = useState<WebSearchConfig>(DEFAULT_WEB_SEARCH_CONFIG)

  const persist = useCallback(
    async (next: WebSearchConfig) => {
      if (!services || !dbReady) return
      await services.settingsManager.set('web_search_config', next)
      setConfig(next)
    },
    [services, dbReady]
  )

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved =
        (await services.settingsManager.get<WebSearchConfig>('web_search_config')) ??
        DEFAULT_WEB_SEARCH_CONFIG
      setConfig({ ...DEFAULT_WEB_SEARCH_CONFIG, ...saved })
    })()
  }, [dbReady, services])

  const patch = (partial: Partial<WebSearchConfig>) => {
    void persist({ ...config, ...partial })
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <SettingsSection title={t('settings.web_search_config_title')}>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.web_search_config_desc')}
        </Text>

        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('agent.tools.param_search_engine')}
        </Text>
        <View style={styles.chipRow}>
          {ENGINES.map((engine) => (
            <TouchableOpacity
              key={engine.id}
              style={[
                styles.chip,
                {
                  borderColor:
                    config.webSearchEngine === engine.id ? colors.primary : colors.borderMuted,
                  backgroundColor:
                    config.webSearchEngine === engine.id ? colors.primaryLight : 'transparent'
                }
              ]}
              onPress={() => patch({ webSearchEngine: engine.id })}
            >
              <Text
                style={{
                  color:
                    config.webSearchEngine === engine.id ? colors.primary : colors.textSecondary
                }}
              >
                {t(engine.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
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
            <TextInput
              style={[
                styles.apiInput,
                {
                  backgroundColor: colors.bgSurfaceHighest,
                  color: colors.textPrimary,
                  borderColor: colors.borderMuted
                }
              ]}
              value={config.tavilyApiKey}
              onChangeText={(v) => patch({ tavilyApiKey: v })}
              placeholder={t('agent.tools.param_tavily_api_key')}
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </>
        )}

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <SliderRow
          title={t('agent.tools.param_max_results')}
          description={t('agent.tools.param_max_results_desc')}
          value={config.webSearchMaxResults}
          min={1}
          max={30}
          step={1}
          onChange={(v) => patch({ webSearchMaxResults: v })}
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
          <Switch
            value={config.webSearchRagEnabled}
            onValueChange={(v) => patch({ webSearchRagEnabled: v })}
          />
        </View>

        {config.webSearchRagEnabled ? (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <SliderRow
              title={t('agent.tools.param_rag_max_chunks')}
              description={t('agent.tools.param_rag_max_chunks_desc')}
              value={config.webSearchRagMaxChunks}
              min={1}
              max={50}
              step={1}
              onChange={(v) => patch({ webSearchRagMaxChunks: v })}
            />
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <SliderRow
              title={t('agent.tools.param_rag_chunks_per_source')}
              description={t('agent.tools.param_rag_chunks_per_source_desc')}
              value={config.webSearchRagChunksPerSource}
              min={1}
              max={20}
              step={1}
              onChange={(v) => patch({ webSearchRagChunksPerSource: v })}
            />
          </>
        ) : (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <SliderRow
              title={t('agent.tools.param_plain_snippet_length')}
              description={t('agent.tools.param_plain_snippet_length_desc')}
              value={config.webSearchPlainSnippetLength}
              min={500}
              max={30000}
              step={100}
              onChange={(v) => patch({ webSearchPlainSnippetLength: v })}
            />
          </>
        )}
      </SettingsSection>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  desc: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  label: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  divider: { height: 1, marginVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  apiInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  }
})
