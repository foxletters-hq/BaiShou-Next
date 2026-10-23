import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { sharedTokens } from '../../theme/tokens'

export const McpAutoApproveRow: React.FC<{
  enabled: boolean
  onChange: (enabled: boolean) => void
}> = ({ enabled, onChange }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View style={[styles.row, { borderTopColor: colors.borderMuted }]}>
      <View style={styles.titleRow}>
        <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
          {t('settings.mcp_auto_approve', 'MCP 工具自动允许')}
        </Text>
        <HelpTooltip
          content={t(
            'settings.mcp_auto_approve_desc',
            '开启后外部客户端调用本机工具（含写入/删除）不再弹窗确认；仅建议在可信网络使用。'
          )}
        />
      </View>
      <Switch value={enabled} onValueChange={onChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  }
})
