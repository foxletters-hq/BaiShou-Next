import { useTranslation } from 'react-i18next'
import React, { useMemo } from 'react'
import {
  AGENT_TOOL_CATEGORY_ORDER,
  AgentGateEffect,
  isEnablingAutoInjectTime,
  normalizeToolManagementConfig
} from '@baishou/shared'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Smile } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { useDialog } from '../Dialog'
import { EmojiSettingsEntryRow } from '../EmojiSettingsView'
import { AgentToolCategoryIcon } from '../icons/agent-tools-icons'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { AgentToolCard } from './AgentToolCard'
import { getAgentTools, getCategoryMeta } from './agent-tools.constants'
import type { AgentToolDef, AgentToolsViewProps, ToolConfigParam } from './agent-tools.types'

export type {
  AgentToolDef,
  AgentToolsViewProps,
  ToolConfigParam,
  ToolManagementConfig
} from './agent-tools.types'

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({
  config,
  onChange,
  resolveToolEffect,
  onToolEffectChange,
  disableScroll,
  onOpenEmojiSettings
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const dialog = useDialog()
  const usePermissionMatrix = Boolean(resolveToolEffect && onToolEffectChange)

  const normalizedConfig = useMemo(() => normalizeToolManagementConfig(config), [config])
  const allTools = useMemo(() => getAgentTools(t), [t])
  const categoryMeta = useMemo(() => getCategoryMeta(t), [t])

  const confirmEnableAutoInjectTime = async (toolId: string, currentlyEnabled: boolean) => {
    if (!isEnablingAutoInjectTime(toolId, currentlyEnabled)) return true
    return dialog.confirm(
      t(
        'agent.tools.auto_inject_time_enable_confirm',
        '开启后，发送给伙伴的每条历史消息都会带上发送时间标签。部分模型可能把这些标签抄进回复，聊天气泡里会出现类似 <message-time> 的文字。确定开启？'
      ),
      t('agent.tools.auto_inject_time_enable_confirm_title', '开启当前时间？')
    )
  }

  const toggleTool = async (toolId: string) => {
    const disabledList = Array.isArray(normalizedConfig.disabledToolIds)
      ? [...normalizedConfig.disabledToolIds]
      : []
    const isCurrentlyEnabled = !disabledList.includes(toolId)

    if (isCurrentlyEnabled) {
      disabledList.push(toolId)
    } else {
      if (!(await confirmEnableAutoInjectTime(toolId, false))) return
      const idx = disabledList.indexOf(toolId)
      if (idx > -1) disabledList.splice(idx, 1)
    }
    onChange({ ...normalizedConfig, disabledToolIds: disabledList })
  }

  const handleToolEffectChange = async (toolId: string, effect: AgentGateEffect) => {
    const currentlyEnabled = resolveToolEffect
      ? resolveToolEffect(toolId) !== AgentGateEffect.Deny
      : !(normalizedConfig.disabledToolIds || []).includes(toolId)
    if (
      effect !== AgentGateEffect.Deny &&
      !(await confirmEnableAutoInjectTime(toolId, currentlyEnabled))
    ) {
      return
    }
    onToolEffectChange?.(toolId, effect)
  }

  const setToolParam = (toolId: string, key: string, value: unknown) => {
    const customConfigs = { ...(normalizedConfig.customConfigs || {}) }
    if (!customConfigs[toolId]) {
      customConfigs[toolId] = {}
    }
    customConfigs[toolId] = { ...customConfigs[toolId], [key]: value }
    onChange({ ...normalizedConfig, customConfigs })
  }

  const getToolParam = (toolId: string, param: ToolConfigParam) => {
    const customConfigs = normalizedConfig.customConfigs || {}
    if (customConfigs[toolId] && customConfigs[toolId][param.key] !== undefined) {
      return customConfigs[toolId][param.key]
    }
    return param.defaultValue
  }

  const groupedTools = useMemo(() => {
    return allTools.reduce(
      (acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = []
        acc[tool.category].push(tool)
        return acc
      },
      {} as Record<string, AgentToolDef[]>
    )
  }, [allTools])

  const emojiConfig = config.emojiConfig || { enabled: false, groups: [] }
  const visibleCategoryKeys = AGENT_TOOL_CATEGORY_ORDER.filter(
    (catKey) => (groupedTools[catKey]?.length ?? 0) > 0
  )
  const lastCategoryKey = visibleCategoryKeys[visibleCategoryKeys.length - 1]

  const content = (
    <View
      style={[
        styles.pageCard,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderStrong
        }
      ]}
    >
      <View
        style={
          lastCategoryKey
            ? [styles.categoryGroup, { borderBottomColor: colors.borderStrong }]
            : styles.categoryGroupLast
        }
      >
        <View style={styles.categoryHeader}>
          <Smile size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          <Text style={[styles.categoryLabel, { color: colors.textPrimary }]}>
            {t('settings.agent_tools_category_interaction', '互动工具')}
          </Text>
        </View>
        <View style={styles.categoryList}>
          <EmojiSettingsEntryRow config={emojiConfig} onPress={() => onOpenEmojiSettings?.()} />
        </View>
      </View>

      {AGENT_TOOL_CATEGORY_ORDER.map((catKey) => {
        const list = groupedTools[catKey]
        if (!list || list.length === 0) return null
        const meta = categoryMeta[catKey]
        const isLast = catKey === lastCategoryKey

        return (
          <View
            key={catKey}
            style={
              isLast
                ? styles.categoryGroupLast
                : [styles.categoryGroup, { borderBottomColor: colors.borderStrong }]
            }
          >
            <View style={styles.categoryHeader}>
              <AgentToolCategoryIcon categoryId={catKey} color={colors.primary} />
              <Text style={[styles.categoryLabel, { color: colors.textPrimary }]}>
                {meta.label}
              </Text>
            </View>
            <View style={styles.categoryList}>
              {list.map((tool, index) => (
                <AgentToolCard
                  key={tool.id}
                  tool={tool}
                  isLastInGroup={index === list.length - 1}
                  config={normalizedConfig}
                  usePermissionMatrix={usePermissionMatrix}
                  resolveToolEffect={resolveToolEffect}
                  onToolEffectChange={handleToolEffectChange}
                  onToggleTool={toggleTool}
                  onSetToolParam={setToolParam}
                  getToolParam={getToolParam}
                />
              ))}
            </View>
          </View>
        )
      })}
    </View>
  )

  if (disableScroll) {
    return <View style={styles.nonScrollContainer}>{content}</View>
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {content}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32
  },
  nonScrollContainer: {
    width: '100%'
  },
  pageCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden'
  },
  categoryGroup: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  categoryGroupLast: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0
  },
  categoryList: {
    backgroundColor: 'transparent'
  }
})
