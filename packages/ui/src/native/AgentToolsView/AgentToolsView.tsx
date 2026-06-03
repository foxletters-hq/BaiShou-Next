import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { SettingsSection } from '../SettingsSection'

export interface AgentToolsViewProps {
  config: {
    disabledToolIds: string[]
    customConfigs: Record<string, Record<string, any>>
  }
  onChange: (config: {
    disabledToolIds: string[]
    customConfigs: Record<string, Record<string, any>>
  }) => void
}

interface ToolDef {
  id: string
  nameKey: string
  categoryKey: string
}

const DIARY_TOOLS: ToolDef[] = [
  {
    id: 'diary_read',
    nameKey: 'agent.tools.diary_read',
    categoryKey: 'settings.agent_tools_category_diary'
  },
  {
    id: 'diary_edit',
    nameKey: 'agent.tools.diary_edit',
    categoryKey: 'settings.agent_tools_category_diary'
  },
  {
    id: 'diary_delete',
    nameKey: 'agent.tools.diary_delete',
    categoryKey: 'settings.agent_tools_category_diary'
  },
  {
    id: 'diary_list',
    nameKey: 'agent.tools.diary_list',
    categoryKey: 'settings.agent_tools_category_diary'
  },
  {
    id: 'diary_search',
    nameKey: 'agent.tools.diary_search',
    categoryKey: 'settings.agent_tools_category_diary'
  }
]

const SUMMARY_TOOLS: ToolDef[] = [
  {
    id: 'summary_read',
    nameKey: 'agent.tools.summary_read',
    categoryKey: 'settings.agent_tools_category_summary'
  },
  {
    id: 'message_search',
    nameKey: 'agent.tools.message_search',
    categoryKey: 'settings.agent_tools_category_summary'
  },
  {
    id: 'memory_store',
    nameKey: 'agent.tools.memory_store',
    categoryKey: 'settings.agent_tools_category_memory'
  },
  {
    id: 'memory_delete',
    nameKey: 'agent.tools.memory_delete',
    categoryKey: 'settings.agent_tools_category_memory'
  }
]

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const isDisabled = (id: string) => config.disabledToolIds.includes(id)

  const toggleTool = (id: string) => {
    const ids = config.disabledToolIds.includes(id)
      ? config.disabledToolIds.filter((x) => x !== id)
      : [...config.disabledToolIds, id]
    onChange({ ...config, disabledToolIds: ids })
  }

  const renderTool = (tool: ToolDef) => (
    <View key={tool.id} style={[styles.toolRow, { borderBottomColor: colors.borderSubtle }]}>
      <View style={styles.toolInfo}>
        <Text style={[styles.toolName, { color: colors.textPrimary }]}>{t(tool.nameKey)}</Text>
        <Text style={[styles.toolId, { color: colors.textTertiary }]}>{tool.id}</Text>
      </View>
      <Switch value={!isDisabled(tool.id)} onValueChange={() => toggleTool(tool.id)} />
    </View>
  )

  return (
    <ScrollView style={styles.scroll}>
      <SettingsSection title={t('settings.agent_tools_category_diary', '日记工具')}>
        {DIARY_TOOLS.map(renderTool)}
      </SettingsSection>

      <SettingsSection title={t('settings.agent_tools_category_summary', '总结工具')}>
        {SUMMARY_TOOLS.filter(
          (tool) => tool.id === 'summary_read' || tool.id === 'message_search'
        ).map(renderTool)}
      </SettingsSection>

      <SettingsSection title={t('settings.agent_tools_category_memory', '记忆工具')}>
        {SUMMARY_TOOLS.filter(
          (tool) => tool.id === 'memory_store' || tool.id === 'memory_delete'
        ).map(renderTool)}
      </SettingsSection>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  toolInfo: { flex: 1, marginRight: 12 },
  toolName: { fontSize: 15, fontWeight: '600' },
  toolId: { fontSize: 12, marginTop: 2 },
  bottomSpacer: { height: 24 }
})
