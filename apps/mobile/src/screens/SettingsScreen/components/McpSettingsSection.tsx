import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import { useNativeTheme, useNativeToast, McpSettingsCard } from '@baishou/ui/native'
import { useMobileMcpConfig } from '../../../hooks/useMobileMcpConfig'

/** 设置枢纽「MCP」独立页（常规设置内已内嵌 MCP，此处保留完整说明） */
export const McpSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const mcp = useMobileMcpConfig()

  const handleCopyEndpoint = async () => {
    try {
      await Clipboard.setStringAsync(mcp.mcpEndpointUrl)
      toast.showSuccess(t('common.copied'))
    } catch {
      toast.showError(t('common.copy_failed'))
    }
  }

  if (mcp.loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <McpSettingsCard
      config={mcp.config}
      mcpEndpointUrl={mcp.mcpEndpointUrl}
      applying={mcp.applying}
      isRunning={mcp.isRunning}
      activePort={mcp.activePort}
      onChange={(next) => void mcp.persistConfig(next)}
      onCopyEndpoint={() => void handleCopyEndpoint()}
      onShowTools={() => void mcp.showToolsDialog()}
    />
  )
}

const styles = StyleSheet.create({
  loading: {
    padding: 24,
    alignItems: 'center'
  }
})
