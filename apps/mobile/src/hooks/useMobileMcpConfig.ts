import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Network from 'expo-network'
import type { McpServerConfig } from '@baishou/shared'
import { useNativeToast, useDialog, McpToolsListContent } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004
}

export function useMobileMcpConfig() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const [config, setConfig] = useState<McpServerConfig>(DEFAULT_MCP_CONFIG)
  const [deviceIp, setDeviceIp] = useState('127.0.0.1')
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!dbReady || !services) return
    const load = async () => {
      try {
        const saved =
          (await services.settingsManager.get<McpServerConfig>('mcp_server_config')) ||
          DEFAULT_MCP_CONFIG
        setConfig(saved)
        const ip = await Network.getIpAddressAsync()
        if (ip && ip !== '0.0.0.0') setDeviceIp(ip)
      } catch (e) {
        console.warn('Load MCP config failed', e)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [dbReady, services])

  const mcpEndpointUrl = `http://${deviceIp}:${config.mcpPort}/mcp`
  const persistConfig = useCallback(
    async (next: McpServerConfig) => {
      if (!services || !dbReady) return
      setApplying(true)
      try {
        await services.settingsManager.set('mcp_server_config', next)
        setConfig(next)
        // 延迟 300ms 待展开/收起动画执行完毕后，再在后台启动或停止 MCP 原生服务
        setTimeout(async () => {
          try {
            await services.mobileMcpService.applyConfig(next)
            toast.showSuccess(t('settings.mcp_saved'))
          } catch (e) {
            console.error(e)
            toast.showError(t('common.errors.save_failed'))
          } finally {
            setApplying(false)
          }
        }, 300)
      } catch (e) {
        console.error(e)
        toast.showError(t('common.errors.save_failed'))
        setApplying(false)
      }
    },
    [dbReady, services, t, toast]
  )

  const showToolsDialog = useCallback(async () => {
    try {
      const tools = services?.mobileMcpService.getToolsList() || []
      if (tools.length === 0) {
        toast.showWarning(t('settings.mcp_no_tools'))
        return
      }
      await dialog.alert(
        React.createElement(McpToolsListContent, { tools }),
        t('settings.mcp_tools_list', 'MCP 暴露工具列表')
      )
    } catch (e) {
      console.error(e)
      toast.showError(t('settings.mcp_tools_fetch_failed', '获取工具列表失败'))
    }
  }, [services, t, toast, dialog])

  return {
    config,
    deviceIp,
    loading,
    applying,
    mcpEndpointUrl,
    persistConfig,
    showToolsDialog,
    isRunning: services?.mobileMcpService.isServerRunning() ?? false,
    activePort: services?.mobileMcpService.getActivePort()
  }
}
