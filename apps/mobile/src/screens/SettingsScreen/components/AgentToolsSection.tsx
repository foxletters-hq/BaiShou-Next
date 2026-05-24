import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Switch, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/src/native/theme'
import { useBaishou } from '../../providers/BaishouProvider'

const ALL_TOOL_DEFS = [
  { id: 'write_diary', category: '日记', label: '写日记' },
  { id: 'read_diary', category: '日记', label: '读日记' },
  { id: 'search_diary', category: '日记', label: '搜索日记' },
  { id: 'web_search', category: '网络与RAG', label: '网页搜索' },
  { id: 'rag_recall', category: '网络与RAG', label: 'RAG 召回' },
  { id: 'rag_memorize', category: '网络与RAG', label: 'RAG 记忆' },
  { id: 'summary_generate', category: '系统与数据', label: '生成总结' },
  { id: 'git_commit', category: '系统与数据', label: 'Git 提交' },
  { id: 'git_rollback', category: '系统与数据', label: 'Git 回滚' }
]

export const AgentToolsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [toolConfig, setToolConfig] = useState<any>({})

  useEffect(() => {
    if (!dbReady || !services) return
    const loadConfig = async () => {
      try {
        const toolConfigData = (await services.settingsManager.get<any>('tool_config')) || {}
        setToolConfig(toolConfigData)
      } catch (e) {
        console.warn('Load tool config failed', e)
      }
    }
    loadConfig()
  }, [dbReady, services])

  const handleSaveToolConfig = async (config: any) => {
    if (!services || !dbReady) return
    try {
      await services.settingsManager.set('tool_config', config)
      setToolConfig(config)
      Alert.alert(t('common.success', '成功'), t('settings.tool_saved', '工具配置已保存'))
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'))
    }
  }

  const disabledIds: string[] = toolConfig.disabledToolIds || []
  const toggleTool = async (toolId: string) => {
    const newDisabled = disabledIds.includes(toolId)
      ? disabledIds.filter((id) => id !== toolId)
      : [...disabledIds, toolId]
    await handleSaveToolConfig({ disabledToolIds: newDisabled })
  }

  const categories = [...new Set(ALL_TOOL_DEFS.map((t) => t.category))]

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.tools_title', '工具管理')}
      </Text>
      <Text style={[styles.sectionValue, { color: colors.textSecondary }]}>
        {t('settings.disabled_tools', '已禁用')}: {disabledIds.length}/{ALL_TOOL_DEFS.length}
      </Text>

      {categories.map((category) => (
        <View key={category}>
          <Text style={[styles.toolCategoryTitle, { color: colors.textSecondary }]}>
            {category}
          </Text>
          {ALL_TOOL_DEFS.filter((t) => t.category === category).map((tool) => (
            <View
              key={tool.id}
              style={[styles.toolItem, { backgroundColor: colors.bgSurfaceHighest }]}
            >
              <Text style={[styles.toolLabel, { color: colors.textPrimary }]}>{tool.label}</Text>
              <Switch
                value={!disabledIds.includes(tool.id)}
                onValueChange={() => toggleTool(tool.id)}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  sectionValue: {
    fontSize: 12,
    marginBottom: 12
  },
  toolCategoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  toolItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4
  },
  toolLabel: {
    fontSize: 14,
    fontWeight: '500'
  }
})
