import React from 'react'
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Switch } from '../Switch'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface McpToolListItem {
  name: string
  toolId?: string
  displayName?: string
  description: string
  category?: string
  enabled?: boolean
}

export interface McpToolsListContentProps {
  tools: McpToolListItem[]
  inline?: boolean
  disabledToolIds?: string[]
  onToggleTool?: (toolId: string) => void
}

export const McpToolsListContent: React.FC<McpToolsListContentProps> = ({
  tools,
  inline = false,
  disabledToolIds,
  onToggleTool
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { height: screenHeight } = useWindowDimensions()
  const listMaxHeight = inline ? undefined : Math.min(400, Math.round(screenHeight * 0.5))

  const items = tools.map((tool, index) => {
    const rawId = tool.toolId || tool.name.replace(/^baishou_/, '')
    const fallbackTitle = tool.displayName && tool.displayName !== rawId ? tool.displayName : rawId
    const localizedTitle = t(`agent.tools.${rawId}`, fallbackTitle)
    const localizedDesc = t(
      `agent.tools.${rawId}_desc`,
      t(`agent.tools.${rawId}_tooltip`, tool.description)
    )
    const categoryKey = tool.category || 'general'
    const localizedCategory = t(`settings.agent_tools_category_${categoryKey}`, categoryKey)
    const isLast = index === tools.length - 1
    const isEnabled = disabledToolIds
      ? !disabledToolIds.includes(rawId) && !disabledToolIds.includes(tool.name)
      : tool.enabled !== false

    const helpContent = (
      <View style={styles.helpPopup}>
        <View style={styles.helpHeader}>
          <Text style={[styles.helpTitle, { color: colors.textPrimary }]}>{localizedTitle}</Text>
          {tool.category ? (
            <Text style={[styles.helpCategory, { color: colors.textTertiary }]}>
              {localizedCategory}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.helpToolName, { color: colors.primary }]} selectable>
          {tool.name}
        </Text>
        <Text style={[styles.helpDesc, { color: colors.textSecondary }]}>{localizedDesc}</Text>
      </View>
    )

    return (
      <View
        key={tool.name}
        style={[
          styles.item,
          !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderSubtle
          },
          !isEnabled && { opacity: 0.6 }
        ]}
      >
        <View style={styles.itemMain}>
          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.localizedTitle, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {localizedTitle}
              </Text>
              <HelpTooltip content={helpContent} />
            </View>
          </View>
          {onToggleTool ? (
            <View style={styles.switchCol}>
              <Switch value={isEnabled} onValueChange={() => onToggleTool(rawId)} />
            </View>
          ) : null}
        </View>
      </View>
    )
  })

  if (inline) {
    return <View style={styles.listContent}>{items}</View>
  }

  return (
    <ScrollView
      style={[styles.list, { maxHeight: listMaxHeight }]}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      bounces
      overScrollMode="always"
    >
      {items}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0
  },
  listContent: {
    paddingBottom: sharedTokens.spacing.xxs
  },
  item: {
    paddingVertical: sharedTokens.spacing.smPlus
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.mdTight
  },
  infoCol: {
    flex: 1,
    minWidth: 0
  },
  switchCol: {
    flexShrink: 0
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    minWidth: 0
  },
  localizedTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    flexShrink: 1
  },
  helpPopup: {
    gap: sharedTokens.spacing.xsPlus
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus
  },
  helpTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  helpCategory: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  helpToolName: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  helpDesc: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  }
})
