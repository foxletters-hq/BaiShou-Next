import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Network from 'expo-network'
import type { McpServerConfig } from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004
}

export function useMobileMcpConfig() {
  const { t } = useTranslation()
  const toast = useNativeToast()
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
        await services.mobileMcpService.applyConfig(next)
        toast.showSuccess(t('settings.mcp_saved'))
      } catch (e) {
        console.error(e)
        toast.showError(t('common.errors.save_failed'))
      } finally {
        setApplying(false)
      }
    },
    [dbReady, services, t, toast]
  )

  const showToolsAlert = useCallback(() => {
    const tools = services?.mobileMcpService.getToolsList() || []
    if (tools.length === 0) {
      toast.showInfo(t('settings.mcp_no_tools'))
      return
    }
    const lines = tools.map((tool) => {
      const cleanName = tool.displayName || tool.name.replace(/^baishou_/, '')
      const localizedTitle = t(`agent.tools.${cleanName}`, cleanName)
      const localizedDesc = t(`agent.tools.${cleanName}_desc`, tool.description)
      return `• ${tool.name} (${localizedTitle})\n  ${localizedDesc}`
    })
    toast.showInfo(lines.join('\n'))
  }, [services, t, toast])

  return {
    config,
    deviceIp,
    loading,
    applying,
    mcpEndpointUrl,
    persistConfig,
    showToolsAlert,
    isRunning: services?.mobileMcpService.isServerRunning() ?? false,
    activePort: services?.mobileMcpService.getActivePort()
  }
}
