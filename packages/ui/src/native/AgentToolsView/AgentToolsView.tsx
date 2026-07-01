import { useTranslation } from 'react-i18next'
import React, { useMemo, useState } from 'react'
import { normalizeToolManagementConfig } from '@baishou/shared'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { HelpTooltip } from '../Tooltip/HelpTooltip'

export interface ToolManagementConfig {
  disabledToolIds: string[]
  customConfigs: Record<string, Record<string, unknown>>
}

export interface AgentToolsViewProps {
  config: ToolManagementConfig
  onChange: (config: ToolManagementConfig) => void
  disableScroll?: boolean
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
}

// Mapping tool IDs to MaterialIcons glyphs
const TOOL_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  diary_read: 'menu-book',
  diary_edit: 'edit',
  diary_delete: 'delete',
  diary_list: 'list',
  diary_search: 'search',
  summary_read: 'description',
  message_search: 'message',
  memory_store: 'storage',
  memory_delete: 'delete-forever',
  auto_inject_time: 'schedule'
}

// Mapping category IDs to MaterialIcons glyphs
const CATEGORY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  diary: 'book',
  summary: 'description',
  memory: 'psychology',
  search: 'public',
  general: 'extension'
}

const getAgentTools = (t: (key: string, fallback: string) => string): AgentToolDef[] => [
  {
    id: 'diary_read',
    category: 'diary',
    name: t('agent.tools.diary_read', '日记读取'),
    tooltipKey: 'agent.tools.diary_read_tooltip'
  },
  {
    id: 'diary_edit',
    category: 'diary',
    name: t('agent.tools.diary_edit', '日记编辑'),
    tooltipKey: 'agent.tools.diary_edit_tooltip'
  },
  {
    id: 'diary_delete',
    category: 'diary',
    name: t('agent.tools.diary_delete', '日记删除'),
    tooltipKey: 'agent.tools.diary_delete_tooltip'
  },
  {
    id: 'diary_list',
    category: 'diary',
    name: t('agent.tools.diary_list', '日记列表'),
    tooltipKey: 'agent.tools.diary_list_tooltip'
  },
  {
    id: 'diary_search',
    category: 'diary',
    name: t('agent.tools.diary_search', '日记搜索'),
    tooltipKey: 'agent.tools.diary_search_tooltip',
    configurableParams: [
      {
        key: 'max_results',
        label: t('agent.tools.param_max_results', '搜索结果上限'),
        type: 'integer',
        defaultValue: 10,
        min: 1,
        max: 50,
        icon: 'ListOrdered'
      }
    ]
  },
  {
    id: 'summary_read',
    category: 'summary',
    name: t('agent.tools.summary_read', '总结读取'),
    tooltipKey: 'agent.tools.summary_read_tooltip'
  },
  {
    id: 'message_search',
    category: 'memory',
    name: t('agent.tools.message_search', '消息搜索'),
    tooltipKey: 'agent.tools.message_search_tooltip'
  },
  {
    id: 'memory_store',
    category: 'memory',
    name: t('agent.tools.memory_store', '记忆存储'),
    tooltipKey: 'agent.tools.memory_store_tooltip'
  },
  {
    id: 'memory_delete',
    category: 'memory',
    name: t('agent.tools.memory_delete', '记忆删除'),
    tooltipKey: 'agent.tools.memory_delete_tooltip'
  },
  {
    id: 'auto_inject_time',
    category: 'general',
    name: t('agent.tools.auto_inject_time', '当前时间'),
    tooltipKey: 'agent.tools.auto_inject_time_tooltip'
  }
]

const getCategoryMeta = (t: (key: string, fallback: string) => string) => ({
  diary: {
    label: t('settings.agent_tools_category_diary', '日记工具')
  },
  summary: {
    label: t('settings.agent_tools_category_summary', '总结工具')
  },
  memory: {
    label: t('settings.agent_tools_category_memory', '记忆工具')
  },
  general: {
    label: t('settings.agent_tools_category_general', '通用工具')
  }
})

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({
  config,
  onChange,
  disableScroll
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const [showCommunity, setShowCommunity] = useState(false)

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
      <View style={[styles.tabSwitcher, { backgroundColor: colors.bgSurfaceNormal }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            !showCommunity && [styles.tabActive, { backgroundColor: colors.primary }]
          ]}
          onPress={() => setShowCommunity(false)}
        >
          <MaterialIcons
            name="verified"
            size={16}
            color={!showCommunity ? colors.textOnPrimary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: !showCommunity ? colors.textOnPrimary : colors.textSecondary }
            ]}
          >
            {t('agent.tools.built_in', '内置工具')}
          </Text>
          <View
            style={[
              styles.tabBadge,
              {
                backgroundColor: !showCommunity ? 'rgba(255,255,255,0.2)' : colors.bgSurfaceHigh
              }
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                { color: !showCommunity ? colors.textOnPrimary : colors.textSecondary }
              ]}
            >
              {allTools.length}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            showCommunity && [styles.tabActive, { backgroundColor: colors.primary }]
          ]}
          onPress={() => setShowCommunity(true)}
        >
          <MaterialIcons
            name="storefront"
            size={16}
            color={showCommunity ? colors.textOnPrimary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: showCommunity ? colors.textOnPrimary : colors.textSecondary }
            ]}
          >
            {t('agent.tools.community', '社区工具')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderToolCard = (tool: AgentToolDef, isLastInGroup: boolean) => {
    const isEnabled = !(normalizedConfig.disabledToolIds || []).includes(tool.id)
    const hasParams = tool.configurableParams && tool.configurableParams.length > 0
    const toolIcon = TOOL_ICONS[tool.id] || 'extension'

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
              <MaterialIcons
                name={toolIcon}
                size={20}
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
                  <Text style={[styles.toolIdText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {tool.id}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.switchSlot}>
            <Switch value={isEnabled} onValueChange={() => toggleTool(tool.id)} />
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
                    <MaterialIcons
                      name={param.icon === 'ListOrdered' ? 'format-list-numbered' : 'tune'}
                      size={18}
                      color={colors.textSecondary}
                    />
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
                      <MaterialIcons name="remove" size={16} color={colors.textSecondary} />
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
                      <MaterialIcons name="add" size={16} color={colors.textSecondary} />
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
      {Object.keys(categoryMeta).map((catKey) => {
        const list = groupedTools[catKey]
        if (!list || list.length === 0) return null
        const meta = (categoryMeta as any)[catKey]
        const catIcon = CATEGORY_ICONS[catKey] || 'extension'

        return (
          <View key={catKey} style={styles.categoryGroup}>
            <View style={styles.categoryHeader}>
              <MaterialIcons name={catIcon} size={18} color={colors.primary} />
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

  const renderCommunityTab = () => (
    <View style={styles.communityBlank}>
      <MaterialIcons
        name="rocket"
        size={56}
        color={colors.textTertiary}
        style={styles.communityIcon}
      />
      <Text style={[styles.communityTitle, { color: colors.textSecondary }]}>
        {t('agent.tools.community_market_coming', '插件集市即将上线')}
      </Text>
      <Text style={[styles.communityDesc, { color: colors.textTertiary }]}>
        {t(
          'agent.tools.community_coming_soon',
          '不久后，您将能够在这里挂载由其他用户开发的生态能力接口。'
        )}
      </Text>
    </View>
  )

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
    borderRadius: 12,
    padding: 4
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6
  },
  tabActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: '600'
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
