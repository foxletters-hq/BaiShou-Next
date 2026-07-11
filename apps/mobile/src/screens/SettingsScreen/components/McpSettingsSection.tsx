import React, { useCallback } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import {
  useNativeTheme,
  useNativeToast,
  McpSettingsCard,
  McpToolsListPanel
} from '@baishou/ui/native'
import { useMobileMcpConfig } from '../../../hooks/useMobileMcpConfig'

/** 设置枢纽「MCP」独立页（常规设置内已内嵌 MCP，此处保留完整说明） */
export const McpSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const {
    config,
    mcpEndpointUrl,
    applying,
    isRunning,
    activePort,
    loading,
    persistConfig,
    refreshAuthToken,
    tools,
    toolsLoading,
    toolsFailed,
    reloadTools
  } = useMobileMcpConfig()

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        void reloadTools()
      }
    }, [loading, reloadTools])
  )

  const handleCopyEndpoint = async () => {
    try {
      await Clipboard.setStringAsync(mcpEndpointUrl)
      toast.showSuccess(t('common.copied'))
    } catch {
      toast.showError(t('common.copy_failed'))
    }
  }

  const handleCopyToken = async () => {
    if (!config.mcpAuthToken) return
    try {
      await Clipboard.setStringAsync(config.mcpAuthToken)
      toast.showSuccess(t('common.copied'))
    } catch {
      toast.showError(t('common.copy_failed'))
    }
  }

  const handleRefreshToken = () => {
    void refreshAuthToken()
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <McpSettingsCard
        config={config}
        mcpEndpointUrl={mcpEndpointUrl}
        applying={applying}
        isRunning={isRunning}
        activePort={activePort}
        onChange={(next) => void persistConfig(next)}
        onCopyEndpoint={() => void handleCopyEndpoint()}
        onCopyToken={() => void handleCopyToken()}
        onRefreshToken={handleRefreshToken}
      />
      <McpToolsListPanel tools={tools} loading={toolsLoading} failed={toolsFailed} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: 16
  },
  loading: {
    padding: 24,
    alignItems: 'center'
  }
})
