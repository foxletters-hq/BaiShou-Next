import { useTranslation } from 'react-i18next'
import React, { useMemo } from 'react'
import {
  AGENT_TOOL_CATEGORY_ORDER,
  AgentGateEffect,
  isEnablingAutoInjectTime,
  normalizeToolManagementConfig,
  publishPlayfulProcessStatus
} from '@baishou/shared'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Smile } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { useDialog } from '../Dialog'
import { Switch } from '../Switch'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { EmojiSettingsEntryRow } from '../EmojiSettingsView'
import { AgentToolCategoryIcon } from '../icons/agent-tools-icons'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { AgentToolCard } from './AgentToolCard'
import { getAgentTools, getCategoryMeta } from './agent-tools.constants'
import type { AgentToolDef, AgentToolsViewProps, ToolConfigParam } from './agent-tools.types'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
  const playfulEnabled = normalizedConfig.playfulProcessStatus !== false
  const visibleCategoryKeys = AGENT_TOOL_CATEGORY_ORDER.filter(
    (catKey) => (groupedTools[catKey]?.length ?? 0) > 0
  )
  const lastCategoryKey = visibleCategoryKeys[visibleCategoryKeys.length - 1]

  const togglePlayfulProcessStatus = (next: boolean) => {
    publishPlayfulProcessStatus(next)
    onChange({ ...normalizedConfig, playfulProcessStatus: next })
  }

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
          <View
            style={[
              styles.interactionRow,
              {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.borderSubtle
              }
            ]}
          >
            <View style={styles.interactionInfo}>
              <View style={styles.interactionTitleRow}>
                <Text style={[styles.interactionTitle, { color: colors.textPrimary }]}>
                  {t('agent.tools.playful_process_status', '趣味思考状态')}
                </Text>
                <HelpTooltip
                  content={t(
                    'agent.tools.playful_process_status_help',
                    '开启后，伙伴在思考与调用工具时，工作过程顶部将轮播「伙伴正在喝茶…」等趣味日常状态；关闭后恢复「深度思考中…」等经典提示。'
                  )}
                  size={16}
                />
              </View>
              <Text style={[styles.interactionMeta, { color: colors.textTertiary }]}>
                {t(
                  'agent.tools.playful_process_status_desc',
                  '在工作过程顶部展示伙伴的趣味日常动态'
                )}
              </Text>
            </View>
            <Switch value={playfulEnabled} onValueChange={togglePlayfulProcessStatus} />
          </View>
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
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.xl
  },
  nonScrollContainer: {
    width: '100%'
  },
  pageCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.md,
    overflow: 'hidden'
  },
  categoryGroup: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.mdTight,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  categoryGroupLast: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.mdTight
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.smPlus
  },
  categoryLabel: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600',
    letterSpacing: 0
  },
  categoryList: {
    backgroundColor: 'transparent'
  },
  interactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.smPlus
  },
  interactionInfo: {
    flex: 1,
    gap: sharedTokens.spacing.xxs
  },
  interactionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  interactionTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  interactionMeta: {
    fontSize: mobileTypography.caption.fontSize
  }
})
