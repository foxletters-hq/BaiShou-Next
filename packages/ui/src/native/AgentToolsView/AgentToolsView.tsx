import { useTranslation } from 'react-i18next'
import React, { useMemo } from 'react'
import {
  normalizeToolManagementConfig,
  type EmojiToolConfig,
  AGENT_TOOL_CATEGORY_ORDER,
  AGENT_TOOL_UI_DEFS
} from '@baishou/shared'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform
} from 'react-native'
import { ListOrdered, Minus, Plus, Smile } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { EmojiSettingsEntryRow } from '../EmojiSettingsView'
import { AgentToolCategoryIcon, AgentToolIcon } from '../icons/agent-tools-icons'
import { AGENT_TOOL_ICON_SIZE, DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

export interface ToolManagementConfig {
  disabledToolIds: string[]
  customConfigs: Record<string, Record<string, unknown>>
  emojiConfig?: EmojiToolConfig
}

export interface AgentToolsViewProps {
  config: ToolManagementConfig
  onChange: (config: ToolManagementConfig) => void
  disableScroll?: boolean
  /** Mobile: pick and import emoji images via image picker */
  onPickAndImportEmojis?: () => Promise<
    { relativePath: string; originalName: string; error: string | null }[]
  >
  /** Mobile: resolve a relativePath to a displayable URI */
  onResolveEmojiPath?: (relativePath: string) => Promise<string>
  /** Mobile: delete an emoji file */
  onDeleteEmoji?: (relativePath: string) => Promise<boolean>
  /** 打开独立表情包设置页 */
  onOpenEmojiSettings?: () => void
}

export interface ToolConfigParam {
  key: string
  label: string
  type: 'integer' | 'boolean' | 'string' | 'select'
  defaultValue: unknown
  min?: number
  max?: number
  icon?: string
}

export interface AgentToolDef {
  id: string
  category: string
  name: string
  tooltipKey: string
  configurableParams?: ToolConfigParam[]
  canBeDisabled?: boolean
}

const TOOL_NAME_FALLBACKS: Record<string, string> = {
  'agent.tools.diary_read': '日记读取',
  'agent.tools.diary_write': '日记写入',
  'agent.tools.diary_edit': '日记编辑',
  'agent.tools.diary_delete': '日记删除',
  'agent.tools.diary_list': '日记列表',
  'agent.tools.diary_search': '日记搜索',
  'agent.tools.summary_read': '总结读取',
  'agent.tools.message_search': '消息搜索',
  'agent.tools.vector_search': '语义搜索',
  'agent.tools.memory_store': '记忆存储',
  'agent.tools.memory_delete': '记忆删除',
  'agent.tools.recall_relations': '回忆关系图谱',
  'agent.tools.graph_upsert': '写入记忆图谱',
  'agent.tools.web_search': '网络搜索',
  'agent.tools.url_read': '网页读取',
  'agent.tools.auto_inject_time': '当前时间',
  'agent.tools.current_time': '查询时间',
  'agent.tools.param_max_results': '搜索结果上限'
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  diary: 'settings.agent_tools_category_diary',
  summary: 'settings.agent_tools_category_summary',
  memory: 'settings.agent_tools_category_memory',
  search: 'settings.agent_tools_category_search',
  general: 'settings.agent_tools_category_general'
}

const CATEGORY_LABEL_FALLBACKS: Record<string, string> = {
  diary: '日记工具',
  summary: '总结工具',
  memory: '记忆工具',
  search: '搜索工具',
  general: '通用工具'
}

const getAgentTools = (t: (key: string, fallback: string) => string): AgentToolDef[] =>
  AGENT_TOOL_UI_DEFS.map((def) => ({
    id: def.id,
    category: def.category,
    name: t(def.nameKey, TOOL_NAME_FALLBACKS[def.nameKey] ?? def.id),
    tooltipKey: def.tooltipKey,
    canBeDisabled: def.canBeDisabled,
    configurableParams: def.configurableParams?.map((param) => ({
      key: param.key,
      label: t(param.labelKey, TOOL_NAME_FALLBACKS[param.labelKey] ?? param.key),
      type: param.type,
      defaultValue: param.defaultValue,
      min: param.min,
      max: param.max,
      icon: param.icon
    }))
  }))

const getCategoryMeta = (t: (key: string, fallback: string) => string) =>
  Object.fromEntries(
    AGENT_TOOL_CATEGORY_ORDER.map((category) => [
      category,
      {
        label: t(CATEGORY_LABEL_KEYS[category], CATEGORY_LABEL_FALLBACKS[category])
      }
    ])
  )

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({
  config,
  onChange,
  disableScroll,
  onOpenEmojiSettings
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const normalizedConfig = useMemo(() => normalizeToolManagementConfig(config), [config])
  const allTools = useMemo(() => getAgentTools(t), [t])
  const categoryMeta = useMemo(() => getCategoryMeta(t), [t])

  const toggleTool = (toolId: string) => {
    const disabledList = Array.isArray(normalizedConfig.disabledToolIds)
      ? [...normalizedConfig.disabledToolIds]
      : []
    const isCurrentlyEnabled = !disabledList.includes(toolId)

    if (isCurrentlyEnabled) {
      disabledList.push(toolId)
    } else {
      const idx = disabledList.indexOf(toolId)
      if (idx > -1) disabledList.splice(idx, 1)
    }
    onChange({ ...normalizedConfig, disabledToolIds: disabledList })
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

  const renderToolCard = (tool: AgentToolDef, isLastInGroup: boolean) => {
    const toggleable = tool.canBeDisabled !== false
    const isEnabled = toggleable
      ? !(normalizedConfig.disabledToolIds || []).includes(tool.id)
      : true
    const hasParams = tool.configurableParams && tool.configurableParams.length > 0

    return (
      <View
        key={tool.id}
        style={
          !isLastInGroup
            ? {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.borderSubtle
              }
            : undefined
        }
      >
        <View style={styles.cardMain}>
          <View style={styles.cardMainLeading}>
            <View style={[styles.toolIconWrapper, { backgroundColor: colors.primaryLight }]}>
              <AgentToolIcon
                toolId={tool.id}
                size={AGENT_TOOL_ICON_SIZE}
                color={colors.primary}
              />
            </View>
            <View style={styles.toolInfo}>
              <View style={styles.toolNameRow}>
                <Text
                  style={[styles.toolName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {tool.name}
                </Text>
                <HelpTooltip
                  content={t(tool.tooltipKey, t(`agent.tools.${tool.id}_desc`, ''))}
                  size={16}
                />
                <View style={[styles.toolIdTag, { backgroundColor: colors.bgSurfaceNormal }]}>
                  <Text
                    style={[styles.toolIdText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {tool.id}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.switchSlot}>
            <Switch
              value={isEnabled}
              disabled={!toggleable}
              onValueChange={() => toggleTool(tool.id)}
            />
          </View>
        </View>

        {hasParams && isEnabled && (
          <>
            <View style={[styles.paramsDivider, { backgroundColor: colors.borderSubtle }]} />
            {tool.configurableParams?.map((param) => {
              const val = getToolParam(tool.id, param) as number
              return (
                <View key={param.key} style={[styles.cardMain, styles.paramRow]}>
                  <View
                    style={[styles.toolIconWrapper, { backgroundColor: colors.primaryLight }]}
                  >
                    {param.icon === 'ListOrdered' ? (
                      <ListOrdered
                        size={16}
                        color={colors.primary}
                        strokeWidth={DEFAULT_STROKE_WIDTH}
                      />
                    ) : null}
                  </View>
                  <View style={[styles.toolInfo, styles.paramInfoRow]}>
                    <Text style={[styles.paramLabel, { color: colors.textPrimary }]}>
                      {param.label}
                    </Text>
                    <HelpTooltip
                      content={t(
                        'agent.tools.param_max_results_tooltip',
                        t('agent.tools.param_max_results_desc', '')
                      )}
                      size={14}
                    />
                  </View>
                  <View style={[styles.stepperContainer, { borderColor: colors.borderMuted }]}>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        val <= (param.min ?? 1) && styles.stepperBtnDisabled
                      ]}
                      disabled={val <= (param.min ?? 1)}
                      onPress={() => setToolParam(tool.id, param.key, val - 1)}
                    >
                      <Minus
                        size={16}
                        color={colors.textSecondary}
                        strokeWidth={DEFAULT_STROKE_WIDTH}
                      />
                    </TouchableOpacity>
                    <TextInput
                      style={[
                        styles.stepperInput,
                        {
                          color: colors.textPrimary,
                          borderLeftColor: colors.borderMuted,
                          borderRightColor: colors.borderMuted
                        }
                      ]}
                      keyboardType="number-pad"
                      value={String(val)}
                      selectTextOnFocus
                      onChangeText={(text) => {
                        const parsed = parseInt(text, 10)
                        if (!isNaN(parsed)) {
                          const clamped = Math.min(
                            Math.max(parsed, param.min ?? 1),
                            param.max ?? 50
                          )
                          setToolParam(tool.id, param.key, clamped)
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        val >= (param.max ?? 50) && styles.stepperBtnDisabled
                      ]}
                      disabled={val >= (param.max ?? 50)}
                      onPress={() => setToolParam(tool.id, param.key, val + 1)}
                    >
                      <Plus
                        size={16}
                        color={colors.textSecondary}
                        strokeWidth={DEFAULT_STROKE_WIDTH}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </>
        )}
      </View>
    )
  }

  const emojiConfig = config.emojiConfig || { enabled: false, groups: [] }

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
      {AGENT_TOOL_CATEGORY_ORDER.map((catKey) => {
        const list = groupedTools[catKey]
        if (!list || list.length === 0) return null
        const meta = categoryMeta[catKey]

        return (
          <View
            key={catKey}
            style={[styles.categoryGroup, { borderBottomColor: colors.borderStrong }]}
          >
            <View style={styles.categoryHeader}>
              <AgentToolCategoryIcon categoryId={catKey} color={colors.primary} />
              <Text style={[styles.categoryLabel, { color: colors.textPrimary }]}>{meta.label}</Text>
            </View>
            <View style={styles.categoryList}>
              {list.map((tool, index) => renderToolCard(tool, index === list.length - 1))}
            </View>
          </View>
        )
      })}

      <View style={styles.categoryGroupLast}>
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
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    gap: 12
  },
  cardMainLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0
  },
  switchSlot: {
    flexShrink: 0
  },
  toolIconWrapper: {
    padding: 6,
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center'
  },
  toolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0
  },
  toolName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1
  },
  toolIdTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
    maxWidth: 120
  },
  toolIdText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace'
  },
  paramsDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4
  },
  paramRow: {
    paddingTop: 8,
    paddingBottom: 12
  },
  paramInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  paramLabel: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden'
  },
  stepperBtn: {
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperBtnDisabled: {
    opacity: 0.2
  },
  stepperInput: {
    width: 40,
    height: 32,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false
  }
})
