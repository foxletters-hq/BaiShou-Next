import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useNativeTheme } from '../theme'
import { NativeSlider } from '../Slider'
import { Switch } from '../Switch'
import { SettingsSection } from '../SettingsSection'

export interface WebSearchSettingsViewProps {
  config: {
    webSearchEnabled: boolean
    searchEngine: string
    maxResults: number
  }
  onChange: (config: {
    webSearchEnabled: boolean
    searchEngine: string
    maxResults: number
  }) => void
}

const ENGINES = [
  { id: 'duckduckgo', label: 'DuckDuckGo' },
  { id: 'tavily', label: 'Tavily' },
  { id: 'exa', label: 'Exa' },
  { id: 'exa-mcp', label: 'Exa MCP' }
]

export const WebSearchSettingsView: React.FC<WebSearchSettingsViewProps> = ({
  config,
  onChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <SettingsSection title={t('websearch.title', '网页搜索设置')}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
              {t('websearch.enable', '启用网页搜索')}
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              {t('websearch.enable_desc', '允许 AI 实时搜索互联网获取最新信息')}
            </Text>
          </View>
          <Switch
            value={config.webSearchEnabled}
            onValueChange={(v) => onChange({ ...config, webSearchEnabled: v })}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('websearch.engine', '搜索引擎')}
          </Text>
          <View style={styles.chipRow}>
            {ENGINES.map((engine) => (
              <TouchableOpacity
                key={engine.id}
                activeOpacity={0.7}
                style={[
                  styles.chip,
                  {
                    borderColor:
                      config.searchEngine === engine.id ? colors.primary : colors.borderMuted,
                    backgroundColor:
                      config.searchEngine === engine.id ? colors.primaryLight : 'transparent'
                  }
                ]}
                onPress={() => onChange({ ...config, searchEngine: engine.id })}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        config.searchEngine === engine.id ? colors.primary : colors.textSecondary
                    }
                  ]}
                >
                  {engine.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.stepperRow}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('websearch.max_results', '搜索结果上限')}
            </Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.stepperBtn,
                  {
                    backgroundColor: colors.bgSurfaceNormal,
                    borderColor: colors.borderMuted
                  }
                ]}
                onPress={() =>
                  onChange({
                    ...config,
                    maxResults: Math.max(1, config.maxResults - 1)
                  })
                }
              >
                <Text style={[styles.stepperBtnText, { color: colors.textPrimary }]}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: colors.textPrimary }]}>
                {config.maxResults}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.stepperBtn,
                  {
                    backgroundColor: colors.bgSurfaceNormal,
                    borderColor: colors.borderMuted
                  }
                ]}
                onPress={() =>
                  onChange({
                    ...config,
                    maxResults: Math.min(30, config.maxResults + 1)
                  })
                }
              >
                <Text style={[styles.stepperBtnText, { color: colors.textPrimary }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <NativeSlider
            value={config.maxResults}
            minValue={1}
            maxValue={30}
            step={1}
            onChange={(v) => onChange({ ...config, maxResults: Math.round(v as number) })}
          />
          <View style={styles.rangeRow}>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>1</Text>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>30</Text>
          </View>
        </View>
      </SettingsSection>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  divider: { height: 1 },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8, flex: 1 },
  chipRow: {
    flexDirection: 'row',
    gap: 8
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperBtnText: { fontSize: 18, fontWeight: '600' },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'center'
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4
  },
  rangeLabel: { fontSize: 11 },
  bottomSpacer: { height: 40 }
})
