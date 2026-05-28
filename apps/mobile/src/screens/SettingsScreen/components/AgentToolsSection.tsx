import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ToolManagementConfig } from '@baishou/shared'

const DEFAULT_TOOL_MANAGEMENT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [],
  customConfigs: {}
}
import { SettingsSection, Switch, useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

const TOOL_IDS = [
  'diary_read',
  'diary_edit',
  'diary_delete',
  'diary_list',
  'diary_search',
  'summary_read',
  'message_search',
  'memory_store',
  'memory_delete',
  'web_search',
  'current_time',
  'url_read'
] as const

const CATEGORY_ORDER = ['diary', 'summary', 'memory', 'search', 'general'] as const

const TOOL_NAME_KEY: Record<(typeof TOOL_IDS)[number], string> = {
  diary_read: 'agent.tools.diary_read',
  diary_edit: 'agent.tools.diary_edit',
  diary_delete: 'agent.tools.diary_delete',
  diary_list: 'agent.tools.diary_list',
  diary_search: 'agent.tools.diary_search',
  summary_read: 'agent.tools.summary_read',
  message_search: 'agent.tools.message_search',
  memory_store: 'agent.tools.memory_store',
  memory_delete: 'agent.tools.memory_delete',
  web_search: 'agent.tools.web_search',
  current_time: 'agent.tools.current_time',
  url_read: 'agent.tools.url_read'
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
  memory_delete: 'memory',
  web_search: 'search',
  current_time: 'general',
  url_read: 'search'
}

const CATEGORY_LABEL_KEY: Record<(typeof CATEGORY_ORDER)[number], string> = {
  diary: 'settings.agent_tools_category_diary',
  summary: 'settings.agent_tools_category_summary',
  memory: 'settings.agent_tools_category_memory',
  search: 'settings.agent_tools_category_search',
  general: 'settings.agent_tools_category_general'
}

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

  return (
    <ScrollView>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('settings.agent_tools_desc')}
      </Text>

      {CATEGORY_ORDER.map((category) => {
        const tools = grouped[category]
        if (!tools?.length) return null
        return (
          <SettingsSection key={category} title={t(CATEGORY_LABEL_KEY[category])}>
            {tools.map((toolId) => {
              const enabled = !config.disabledToolIds.includes(toolId)
              return (
                <View
                  key={toolId}
                  style={[styles.toolRow, { borderBottomColor: colors.borderSubtle }]}
                >
                  <View style={styles.toolText}>
                    <Text style={[styles.toolName, { color: colors.textPrimary }]}>
                      {t(TOOL_NAME_KEY[toolId])}
                    </Text>
                    <Text style={[styles.toolId, { color: colors.textTertiary }]}>{toolId}</Text>
                  </View>
                  <Switch value={enabled} onValueChange={() => toggleTool(toolId)} />
                </View>
              )
            })}
          </SettingsSection>
        )
      })}
    </ScrollView>
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
  toolId: { fontSize: 11, marginTop: 2 }
})
