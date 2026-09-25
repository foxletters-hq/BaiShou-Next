import React, { useCallback } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import {
  useNativeTheme,
  useNativeToast,
  McpSettingsCard,
  McpToolsListPanel,
  SegmentedControl
} from '@baishou/ui/native'
import { useMobileMcpConfig } from '../../../hooks/useMobileMcpConfig'
import { McpClientServersSection } from './McpClientServersSection'

/** 设置枢纽「MCP」独立页（常规设置内已内嵌 MCP，此处保留完整说明） */
export const McpSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const [kind, setKind] = React.useState<'outbound' | 'custom'>('outbound')
  const {
    config,
    mcpEndpointUrl,
    mcpSseEndpointUrl,
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

  const handleCopySseEndpoint = async () => {
    try {
      await Clipboard.setStringAsync(mcpSseEndpointUrl)
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

  const kindTabs = (
    <SegmentedControl
      value={kind}
      onChange={(value) => setKind(value === 'custom' ? 'custom' : 'outbound')}
      options={[
        { value: 'outbound', label: t('settings.mcp_kind_outbound', '对外') },
        { value: 'custom', label: t('settings.mcp_kind_custom', '自定义') }
      ]}
    />
  )

  let body: React.ReactNode
  if (kind === 'custom') {
    body = <McpClientServersSection />
  } else if (loading) {
    body = (
      <View style={{ padding: tokens.spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  } else {
    body = (
      <>
        <McpSettingsCard
          config={config}
          mcpEndpointUrl={mcpEndpointUrl}
          mcpSseEndpointUrl={mcpSseEndpointUrl}
          applying={applying}
          isRunning={isRunning}
          activePort={activePort}
          onChange={(next) => void persistConfig(next)}
          onCopyEndpoint={() => void handleCopyEndpoint()}
          onCopySseEndpoint={() => void handleCopySseEndpoint()}
          onCopyToken={() => void handleCopyToken()}
          onRefreshToken={handleRefreshToken}
        />
        <McpToolsListPanel tools={tools} loading={toolsLoading} failed={toolsFailed} />
      </>
    )
  }

  return (
    <View style={{ gap: tokens.spacing.md }}>
      {kindTabs}
      {body}
    </View>
  )
}
