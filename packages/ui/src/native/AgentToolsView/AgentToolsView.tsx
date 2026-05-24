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
  name: string
  category: string
}

const DIARY_TOOLS: ToolDef[] = [
  { id: 'diary_read', name: '读取日记', category: 'diary' },
  { id: 'diary_edit', name: '编辑日记', category: 'diary' },
  { id: 'diary_delete', name: '删除日记', category: 'diary' },
  { id: 'diary_list', name: '列出日记', category: 'diary' },
  { id: 'diary_search', name: '搜索日记', category: 'diary' }
]

const SUMMARY_TOOLS: ToolDef[] = [
  { id: 'summary_read', name: '读取总结', category: 'summary' },
  { id: 'message_search', name: '搜索消息', category: 'summary' },
  { id: 'memory_store', name: '存储记忆', category: 'memory' },
  { id: 'memory_delete', name: '删除记忆', category: 'memory' }
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
    <View
      key={tool.id}
      style={[styles.toolRow, { borderBottomColor: colors.borderSubtle }]}
    >
      <View style={styles.toolInfo}>
        <Text style={[styles.toolName, { color: colors.textPrimary }]}>{tool.name}</Text>
        <Text style={[styles.toolId, { color: colors.textTertiary }]}>{tool.id}</Text>
      </View>
      <Switch value={!isDisabled(tool.id)} onValueChange={() => toggleTool(tool.id)} />
    </View>
  )

  return (
    <ScrollView style={styles.scroll}>
      <SettingsSection title={t('tools.diary', '日记工具')}>
        {DIARY_TOOLS.map(renderTool)}
      </SettingsSection>

      <SettingsSection title={t('tools.summary_memory', '总结 / 记忆')}>
        {SUMMARY_TOOLS.map(renderTool)}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  toolInfo: { flex: 1, marginRight: 12 },
  toolName: { fontSize: 15, fontWeight: '500' },
  toolId: { fontSize: 12, marginTop: 2 },
  bottomSpacer: { height: 40 }
})
