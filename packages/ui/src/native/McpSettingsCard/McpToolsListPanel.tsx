import React from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { McpToolsListContent, type McpToolListItem } from './McpToolsListContent'

export interface NativeMcpToolsListPanelProps {
  tools: McpToolListItem[]
  loading?: boolean
  failed?: boolean
}

export const McpToolsListPanel: React.FC<NativeMcpToolsListPanelProps> = ({
  tools,
  loading = false,
  failed = false
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
        <Text style={[hubStyles.rowTitle, { color: colors.textPrimary, flex: 1 }]}>
          {t('settings.mcp_tools_provided', '目前提供的工具列表')}
        </Text>
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
        <McpToolsListContent tools={tools} inline />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  count: {
    fontSize: 13,
    fontWeight: '500'
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12
  },
  stateText: {
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 12
  }
})
