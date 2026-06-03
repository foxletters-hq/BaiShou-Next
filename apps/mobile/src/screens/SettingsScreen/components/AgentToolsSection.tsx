import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ToolManagementConfig } from '@baishou/shared'
import { SettingsSection, Switch, useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { SettingsGroupCard } from './SettingsGroupCard'

const DEFAULT_TOOL_MANAGEMENT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [],
  customConfigs: {}
}

/** 与桌面 agent-tools.constants 内置工具一致（不含 web_search 等独立能力） */
const TOOL_IDS = [
  'diary_read',
  'diary_edit',
  'diary_delete',
  'diary_list',
  'diary_search',
  'summary_read',
  'message_search',
  'memory_store',
  'memory_delete'
] as const

const CATEGORY_ORDER = ['diary', 'summary', 'memory'] as const

const TOOL_NAME_KEY: Record<(typeof TOOL_IDS)[number], string> = {
  diary_read: 'agent.tools.diary_read',
  diary_edit: 'agent.tools.diary_edit',
  diary_delete: 'agent.tools.diary_delete',
  diary_list: 'agent.tools.diary_list',
  diary_search: 'agent.tools.diary_search',
  summary_read: 'agent.tools.summary_read',
  message_search: 'agent.tools.message_search',
  memory_store: 'agent.tools.memory_store',
  memory_delete: 'agent.tools.memory_delete'
}

const TOOL_TOOLTIP_KEY: Partial<Record<(typeof TOOL_IDS)[number], string>> = {
  diary_read: 'agent.tools.diary_read_tooltip',
  diary_edit: 'agent.tools.diary_edit_tooltip',
  diary_delete: 'agent.tools.diary_delete_tooltip',
  diary_list: 'agent.tools.diary_list_tooltip',
  diary_search: 'agent.tools.diary_search_tooltip',
  summary_read: 'agent.tools.summary_read_tooltip',
  message_search: 'agent.tools.message_search_tooltip',
  memory_store: 'agent.tools.memory_store_tooltip',
  memory_delete: 'agent.tools.memory_delete_tooltip'
}

const TOOL_CATEGORY: Record<(typeof TOOL_IDS)[number], (typeof CATEGORY_ORDER)[number]> = {
  diary_read: 'diary',
  diary_edit: 'diary',
  diary_delete: 'diary',
  diary_list: 'diary',
  diary_search: 'diary',
  summary_read: 'summary',
  message_search: 'memory',
  memory_store: 'memory',
  memory_delete: 'memory'
}

const CATEGORY_LABEL_KEY: Record<(typeof CATEGORY_ORDER)[number], string> = {
  diary: 'settings.agent_tools_category_diary',
  summary: 'settings.agent_tools_category_summary',
  memory: 'settings.agent_tools_category_memory'
}

const DIARY_SEARCH_MAX_DEFAULT = 10

export const AgentToolsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const [config, setConfig] = useState<ToolManagementConfig>(DEFAULT_TOOL_MANAGEMENT_CONFIG)

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved =
        (await services.settingsManager.get<ToolManagementConfig>('tool_management_config')) ??
        DEFAULT_TOOL_MANAGEMENT_CONFIG
      setConfig({ ...DEFAULT_TOOL_MANAGEMENT_CONFIG, ...saved })
    })()
  }, [dbReady, services])

  const persist = async (next: ToolManagementConfig) => {
    if (!services || !dbReady) return
    await services.settingsManager.set('tool_management_config', next)
    setConfig(next)
  }

  const grouped = useMemo(() => {
    const map: Record<string, Array<(typeof TOOL_IDS)[number]>> = {}
    for (const id of TOOL_IDS) {
      const cat = TOOL_CATEGORY[id]
      if (!map[cat]) map[cat] = []
      map[cat].push(id)
    }
    return map
  }, [])

  const toggleTool = (toolId: string) => {
    const disabled = new Set(config.disabledToolIds)
    if (disabled.has(toolId)) disabled.delete(toolId)
    else disabled.add(toolId)
    void persist({ ...config, disabledToolIds: [...disabled] })
  }

  const diarySearchMax = useMemo(() => {
    const raw = config.customConfigs?.diary_search?.max_results
    const n = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(n) ? n : DIARY_SEARCH_MAX_DEFAULT
  }, [config.customConfigs])

  const setDiarySearchMax = (value: number) => {
    const clamped = Math.min(50, Math.max(1, Math.round(value)))
    void persist({
      ...config,
      customConfigs: {
        ...config.customConfigs,
        diary_search: { ...config.customConfigs?.diary_search, max_results: clamped }
      }
    })
  }

  return (
    <View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('settings.agent_tools_desc')}
      </Text>

      <SettingsGroupCard style={{ padding: 0 }}>
        {CATEGORY_ORDER.map((category) => {
          const tools = grouped[category]
          if (!tools?.length) return null
          return (
            <SettingsSection key={category} title={t(CATEGORY_LABEL_KEY[category])}>
              {tools.map((toolId) => {
                const enabled = !config.disabledToolIds.includes(toolId)
                const tooltipKey = TOOL_TOOLTIP_KEY[toolId]
                return (
                  <View key={toolId}>
                    <View
                      style={[styles.toolRow, { borderBottomColor: colors.borderSubtle }]}
                    >
                      <View style={styles.toolText}>
                        <Text style={[styles.toolName, { color: colors.textPrimary }]}>
                          {t(TOOL_NAME_KEY[toolId])}
                        </Text>
                        {tooltipKey ? (
                          <Text style={[styles.toolHint, { color: colors.textTertiary }]}>
                            {t(tooltipKey)}
                          </Text>
                        ) : null}
                      </View>
                      <Switch value={enabled} onValueChange={() => toggleTool(toolId)} />
                    </View>
                    {toolId === 'diary_search' && enabled && (
                      <View
                        style={[
                          styles.paramRow,
                          { backgroundColor: colors.bgApp, borderColor: colors.borderSubtle }
                        ]}
                      >
                        <Text style={[styles.paramLabel, { color: colors.textSecondary }]}>
                          {t('agent.tools.param_max_results')}
                        </Text>
                        <TextInput
                          style={[
                            styles.paramInput,
                            {
                              color: colors.textPrimary,
                              borderColor: colors.borderMuted,
                              backgroundColor: colors.bgSurface
                            }
                          ]}
                          keyboardType="number-pad"
                          value={String(diarySearchMax)}
                          onChangeText={(text) => {
                            const n = parseInt(text, 10)
                            if (!Number.isNaN(n)) setDiarySearchMax(n)
                          }}
                        />
                      </View>
                    )}
                  </View>
                )
              })}
            </SettingsSection>
          )
        })}
      </SettingsGroupCard>
    </View>
  )
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  toolText: { flex: 1, marginRight: 12 },
  toolName: { fontSize: 15, fontWeight: '500' },
  toolHint: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8
  },
  paramLabel: { fontSize: 13, flex: 1 },
  paramInput: {
    width: 56,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    textAlign: 'center'
  }
})
