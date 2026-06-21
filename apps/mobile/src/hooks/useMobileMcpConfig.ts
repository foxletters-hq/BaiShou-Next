import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Network from 'expo-network'
import type { McpServerConfig } from '@baishou/shared'
import type { McpToolListItem } from '@baishou/ui/native'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004
}

/** 移动端与桌面一致：不生成/保存访问令牌，外部客户端仅需 URL */
function toMobileMcpConfig(config: McpServerConfig): McpServerConfig {
  return {
    mcpEnabled: config.mcpEnabled,
    mcpPort: config.mcpPort
  }
}

export function useMobileMcpConfig() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const [config, setConfig] = useState<McpServerConfig>(DEFAULT_MCP_CONFIG)
  const [deviceIp, setDeviceIp] = useState('127.0.0.1')
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [tools, setTools] = useState<McpToolListItem[]>([])
  const [toolsLoading, setToolsLoading] = useState(true)
  const [toolsFailed, setToolsFailed] = useState(false)

  useEffect(() => {
    if (!dbReady || !services) return
    const load = async () => {
      try {
        const raw =
          (await services.settingsManager.get<McpServerConfig>('mcp_server_config')) ||
          DEFAULT_MCP_CONFIG
        const saved = toMobileMcpConfig(raw)
        if (raw.mcpAuthToken) {
          await services.settingsManager.set('mcp_server_config', saved)
          if (saved.mcpEnabled) {
            await services.mobileMcpService.applyConfig(saved).catch((e) => {
              console.warn('MCP restart after token removal failed', e)
            })
          }
        }
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

  const loadTools = useCallback(async () => {
    if (!dbReady || !services?.mobileMcpService) {
      setTools([])
      setToolsLoading(false)
      setToolsFailed(false)
      return
    }

    setToolsLoading(true)
    setToolsFailed(false)
    try {
      const list = await services.mobileMcpService.getToolsList()
      setTools(list)
    } catch (e) {
      console.error(e)
      setToolsFailed(true)
      setTools([])
    } finally {
      setToolsLoading(false)
    }
  }, [dbReady, services])

  useEffect(() => {
    if (!loading) {
      void loadTools()
    }
  }, [loading, loadTools])

  useEffect(() => {
    if (!applying && !loading) {
      void loadTools()
    }
  }, [applying, loading, loadTools, config.mcpEnabled])

  const mcpEndpointUrl = `http://${deviceIp}:${config.mcpPort}/mcp`
  const persistConfig = useCallback(
    async (next: McpServerConfig) => {
      if (!services || !dbReady) return
      setApplying(true)
      try {
        const saved = toMobileMcpConfig(next)
        await services.settingsManager.set('mcp_server_config', saved)
        setConfig(saved)
        // 延迟 300ms 待展开/收起动画执行完毕后，再在后台启动或停止 MCP 原生服务
        setTimeout(async () => {
          try {
            await services.mobileMcpService.applyConfig(saved)
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

  return {
    config,
    deviceIp,
    loading,
    applying,
    mcpEndpointUrl,
    persistConfig,
    tools,
    toolsLoading,
    toolsFailed,
    reloadTools: loadTools,
    isRunning: services?.mobileMcpService.isServerRunning() ?? false,
    activePort: services?.mobileMcpService.getActivePort()
  }
}
