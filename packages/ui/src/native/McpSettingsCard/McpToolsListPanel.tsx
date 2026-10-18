import React from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { McpToolsListContent, type McpToolListItem } from './McpToolsListContent'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface NativeMcpToolsListPanelProps {
  tools: McpToolListItem[]
  loading?: boolean
  failed?: boolean
  disabledToolIds?: string[]
  onToggleTool?: (toolId: string) => void
}

export const McpToolsListPanel: React.FC<NativeMcpToolsListPanelProps> = ({
  tools,
  loading = false,
  failed = false,
  disabledToolIds,
  onToggleTool
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const countLabel =
    !loading && !failed && tools.length > 0
      ? t('settings.mcp_tools_count', '{{count}} 个工具', { count: tools.length })
      : null

  return (
    <View
      style={[
        styles.panel,
        {
          borderColor: colors.borderSubtle,
          backgroundColor: colors.bgSurface
        }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
            {t('settings.mcp_tools_provided', '目前提供的工具列表')}
          </Text>
          <HelpTooltip
            content={t(
              'settings.mcp_view_tools_desc',
              '查看当前 MCP 服务对外提供的日记与记忆管理等内置工具清单'
            )}
          />
        </View>
        {countLabel ? (
          <Text style={[styles.count, { color: colors.textSecondary }]}>{countLabel}</Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            {t('common.loading', '加载中...')}
          </Text>
        </View>
      ) : null}

      {!loading && failed ? (
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          {t('settings.mcp_tools_fetch_failed', '获取工具列表失败')}
        </Text>
      ) : null}

      {!loading && !failed && tools.length === 0 ? (
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          {t('settings.mcp_no_tools', '未检测到任何暴露的工具')}
        </Text>
      ) : null}

      {!loading && !failed && tools.length > 0 ? (
        <McpToolsListContent
          tools={tools}
          inline
          disabledToolIds={disabledToolIds}
          onToggleTool={onToggleTool}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.md,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.xs
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xs
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  count: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.mdTight
  },
  stateText: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    paddingVertical: sharedTokens.spacing.mdTight
  }
})
