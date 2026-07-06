import { useTranslation } from 'react-i18next'
import React, { useEffect, useMemo, useState } from 'react'
import { normalizeToolManagementConfig, type EmojiToolConfig, AGENT_TOOL_CATEGORY_ORDER, AGENT_TOOL_UI_DEFS } from '@baishou/shared'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Pressable
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { BadgeCheck, ListOrdered, Minus, Plus, Smile, Store } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { EmojiSettingsEntryRow } from '../EmojiSettingsView'
import { AgentToolCategoryIcon, AgentToolIcon } from '../icons/agent-tools-icons'
import { AGENT_TOOL_ICON_SIZE, DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

const TOOL_TAB_PADDING = 6
const TOOL_TAB_GAP = 8

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
  onPickAndImportEmojis?: () => Promise<{ relativePath: string; originalName: string; error: string | null }[]>
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
  onPickAndImportEmojis,
  onResolveEmojiPath,
  onDeleteEmoji,
  onOpenEmojiSettings
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const [showCommunity, setShowCommunity] = useState(false)
  const [toolTabsWidth, setToolTabsWidth] = useState(0)
  const toolTabSlide = useSharedValue(0)

  const toolTabWidth =
    toolTabsWidth > 0 ? (toolTabsWidth - TOOL_TAB_PADDING * 2 - TOOL_TAB_GAP) / 2 : 0

  useEffect(() => {
    toolTabSlide.value = withTiming(showCommunity ? 1 : 0, { duration: 280 })
  }, [showCommunity, toolTabSlide])

  const toolTabIndicatorStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: toolTabSlide.value * (toolTabWidth + TOOL_TAB_GAP) }]
    }),
    [toolTabWidth]
  )

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

  const renderTabSwitcher = () => (
    <View style={styles.tabSwitcherWrapper}>
      <View
        style={[styles.tabSwitcher, { backgroundColor: colors.bgSurfaceNormal }]}
        onLayout={(event) => setToolTabsWidth(event.nativeEvent.layout.width)}
      >
        {toolTabWidth > 0 ? (
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                width: toolTabWidth,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderMuted,
                ...Platform.select({
                  ios: {
                    shadowColor: '#000',
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 }
                  },
                  default: { elevation: 1 }
                })
              },
              toolTabIndicatorStyle
            ]}
          />
        ) : null}
        <Pressable style={styles.tabBtn} onPress={() => setShowCommunity(false)}>
          <BadgeCheck
            size={16}
            color={!showCommunity ? colors.primary : colors.textSecondary}
            strokeWidth={DEFAULT_STROKE_WIDTH}
          />
          <Text
            style={[
              styles.tabText,
              { color: !showCommunity ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('agent.tools.built_in', '内置工具')}
          </Text>
          <View
            style={[
              styles.tabBadge,
              {
                backgroundColor: !showCommunity ? colors.primaryLight : colors.bgSurfaceHigh
              }
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                { color: !showCommunity ? colors.primary : colors.textSecondary }
              ]}
            >
              {allTools.length}
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setShowCommunity(true)}>
          <Store
            size={16}
            color={showCommunity ? colors.primary : colors.textSecondary}
            strokeWidth={DEFAULT_STROKE_WIDTH}
          />
          <Text
            style={[
              styles.tabText,
              { color: showCommunity ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('agent.tools.community', '趣味工具')}
          </Text>
        </Pressable>
      </View>
    </View>
  )

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
                borderBottomWidth: 1,
                borderBottomColor: colors.borderStrong
              }
            : undefined
        }
      >
        <View style={styles.cardMain}>
          <View style={[styles.cardMainLeading, !isEnabled && styles.cardMainDisabled]}>
            <View
              style={[
                styles.toolIconWrapper,
                {
                  backgroundColor: isEnabled ? colors.primaryLight : colors.bgSurfaceNormal
                }
              ]}
            >
              <AgentToolIcon
                toolId={tool.id}
                size={AGENT_TOOL_ICON_SIZE}
                color={isEnabled ? colors.primary : colors.textSecondary}
              />
            </View>
            <View style={styles.toolInfo}>
              <View style={styles.toolNameRow}>
                <Text
                  style={[
                    styles.toolName,
                    { color: isEnabled ? colors.textPrimary : colors.textSecondary }
                  ]}
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
            <View style={[styles.paramsDivider, { backgroundColor: colors.borderStrong }]} />
            {tool.configurableParams?.map((param) => {
              const val = getToolParam(tool.id, param) as number
              return (
                <View key={param.key} style={[styles.cardMain, styles.paramRow]}>
                  <View
                    style={[styles.toolIconWrapper, { backgroundColor: colors.bgSurfaceNormal }]}
                  >
                    {param.icon === 'ListOrdered' ? (
                      <ListOrdered
                        size={18}
                        color={colors.textSecondary}
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
                      <Minus size={16} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
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
                      <Plus size={16} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
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

  const renderBuiltInList = () => (
    <View style={styles.list}>
      {AGENT_TOOL_CATEGORY_ORDER.map((catKey) => {
        const list = groupedTools[catKey]
        if (!list || list.length === 0) return null
        const meta = (categoryMeta as any)[catKey]

        return (
          <View key={catKey} style={styles.categoryGroup}>
            <View style={styles.categoryHeader}>
              <AgentToolCategoryIcon categoryId={catKey} color={colors.primary} />
              <Text style={[styles.categoryLabel, { color: colors.primary }]}>{meta.label}</Text>
            </View>
            <View
              style={[
                styles.categoryList,
                {
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.bgSurface
                }
              ]}
            >
              {list.map((tool, index) => renderToolCard(tool, index === list.length - 1))}
            </View>
          </View>
        )
      })}
    </View>
  )

  const renderCommunityTab = () => {
    const emojiConfig = config.emojiConfig || { enabled: false, groups: [] }

    return (
      <View style={styles.list}>
        <View style={styles.categoryGroup}>
          <View style={styles.categoryHeader}>
            <Smile size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            <Text style={[styles.categoryLabel, { color: colors.primary }]}>
              {t('settings.agent_tools_category_interaction', '互动工具')}
            </Text>
          </View>
          <View
            style={[
              styles.categoryList,
              {
                borderColor: colors.borderStrong,
                backgroundColor: colors.bgSurface
              }
            ]}
          >
            <EmojiSettingsEntryRow
              config={emojiConfig}
              onPress={() => onOpenEmojiSettings?.()}
            />
          </View>
        </View>
      </View>
    )
  }

  const Container = disableScroll ? View : ScrollView
  const containerProps = disableScroll
    ? { style: styles.nonScrollContainer }
    : {
        style: styles.scroll,
        contentContainerStyle: styles.scrollContent,
        keyboardShouldPersistTaps: 'handled' as const
      }

  return (
    <Container {...containerProps}>
      {!disableScroll && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('settings.agent_tools_desc', '管理伙伴可使用的工具，开关或配置工具参数')}
        </Text>
      )}

      {renderTabSwitcher()}

      <View style={styles.contentArea}>
        {!showCommunity ? renderBuiltInList() : renderCommunityTab()}
      </View>
    </Container>
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
    flex: 1
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20
  },
  tabSwitcherWrapper: {
    marginBottom: 16
  },
  tabSwitcher: {
    flexDirection: 'row',
    gap: TOOL_TAB_GAP,
    borderRadius: 12,
    padding: TOOL_TAB_PADDING,
    overflow: 'hidden',
    position: 'relative'
  },
  tabIndicator: {
    position: 'absolute',
    top: TOOL_TAB_PADDING,
    bottom: TOOL_TAB_PADDING,
    left: TOOL_TAB_PADDING,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    zIndex: 1
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700'
  },
  tabBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  contentArea: {
    flex: 1
  },
  list: {
    paddingBottom: 24
  },
  categoryGroup: {
    marginBottom: 16
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 8,
    marginBottom: 8
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  categoryList: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden'
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 12
  },
  cardMainLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0
  },
  cardMainDisabled: {
    opacity: 0.75
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
    fontSize: 15,
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
    marginHorizontal: 12
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
  },
  communityBlank: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    paddingVertical: 20
  },
  communityIcon: {
    marginBottom: 16
  },
  communityTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8
  },
  communityDesc: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18
  }
})
