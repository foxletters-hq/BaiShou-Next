import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Network from 'expo-network'
import type { McpServerConfig } from '@baishou/shared'
import { appendMcpVaultQuery, ensureMcpAuthToken, refreshMcpAuthToken } from '@baishou/shared'
import type { McpToolListItem } from '@baishou/ui/native'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004,
  mcpAuthEnabled: false,
  mcpAutoApproveTools: false,
  disabledToolIds: []
}

async function persistMcpConfig(
  services: NonNullable<ReturnType<typeof useBaishou>['services']>,
  config: McpServerConfig
): Promise<McpServerConfig> {
  const saved = ensureMcpAuthToken(config)
  await services.settingsManager.set('mcp_server_config', saved)
  return saved
}

export function useMobileMcpConfig() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services, dbReady, vaultRevision } = useBaishou()
  const [config, setConfig] = useState<McpServerConfig>(DEFAULT_MCP_CONFIG)
  const [deviceIp, setDeviceIp] = useState('127.0.0.1')
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [tools, setTools] = useState<McpToolListItem[]>([])
  const [toolsLoading, setToolsLoading] = useState(true)
  const [toolsFailed, setToolsFailed] = useState(false)

  useEffect(() => {
    const vaultService = services?.vaultService
    if (!dbReady || !vaultService) return
    const loadVaults = async () => {
      try {
        await vaultService.initRegistry()
        const all = vaultService.getAllVaults()
        const active = vaultService.getActiveVault()
        const items = all
          .filter((v) => v && typeof v.id === 'string' && typeof v.name === 'string')
          .map((v) => ({ id: v.id, name: v.name }))
        setWorkspaces(items)
        setSelectedWorkspaceId((prev) => {
          if (prev && items.some((w) => w.id === prev)) return prev
          return active?.id || items[0]?.id
        })
      } catch {
        // ignore
      }
    }
    void loadVaults()
  }, [dbReady, services?.vaultService, vaultRevision])

  useEffect(() => {
    if (!dbReady || !services) return
    const load = async () => {
      try {
        const raw =
          (await services.settingsManager.get<McpServerConfig>('mcp_server_config')) ||
          DEFAULT_MCP_CONFIG
        const saved = await persistMcpConfig(services, raw)
        setConfig(saved)
        if (saved.mcpEnabled) {
          await services.mobileMcpService.applyConfig(saved).catch((e) => {
            console.warn('MCP restart after config load failed', e)
          })
        }
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
    if (loading || applying) return
    void loadTools()
  }, [applying, config.mcpEnabled, loadTools, loading])

  const effectiveWorkspaceId =
    workspaces.length > 0 ? selectedWorkspaceId || workspaces[0].id : undefined
  const mcpEndpointUrl = appendMcpVaultQuery(
    `http://${deviceIp}:${config.mcpPort}/mcp`,
    effectiveWorkspaceId
  )
  const mcpSseEndpointUrl = appendMcpVaultQuery(
    `http://${deviceIp}:${config.mcpPort}/sse`,
    effectiveWorkspaceId
  )
  const persistConfig = useCallback(
    async (next: McpServerConfig) => {
      if (!services || !dbReady) return
      const needsServerApply =
        next.mcpEnabled !== config.mcpEnabled ||
        next.mcpPort !== config.mcpPort ||
        next.mcpAuthEnabled !== config.mcpAuthEnabled ||
        next.mcpAuthToken !== config.mcpAuthToken

      if (!needsServerApply) {
        try {
          const saved = await persistMcpConfig(services, next)
          setConfig(saved)
          await services.mobileMcpService.applyConfig(saved)
        } catch (e) {
          console.error(e)
          toast.showError(t('common.errors.save_failed'))
        }
        return
      }

      setApplying(true)
      try {
        const saved = await persistMcpConfig(services, next)
        setConfig(saved)
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
    [
      config.mcpAuthEnabled,
      config.mcpAuthToken,
      config.mcpEnabled,
      config.mcpPort,
      dbReady,
      services,
      t,
      toast
    ]
  )

  const refreshAuthToken = useCallback(async () => {
    if (!services || !dbReady) return
    setApplying(true)
    try {
      const next = refreshMcpAuthToken(config)
      const saved = await persistMcpConfig(services, next)
      setConfig(saved)
      await services.mobileMcpService.applyConfig(saved)
      toast.showSuccess(t('settings.mcp_token_refreshed'))
    } catch (e) {
      console.error(e)
      toast.showError(t('common.errors.save_failed'))
    } finally {
      setApplying(false)
    }
  }, [config, dbReady, services, t, toast])

  return {
    config,
    deviceIp,
    workspaces,
    selectedWorkspaceId: effectiveWorkspaceId,
    setSelectedWorkspaceId,
    loading,
    applying,
    mcpEndpointUrl,
    mcpSseEndpointUrl,
    persistConfig,
    refreshAuthToken,
    tools,
    toolsLoading,
    toolsFailed,
    reloadTools: loadTools,
    isRunning: services?.mobileMcpService.isServerRunning() ?? false,
    activePort: services?.mobileMcpService.getActivePort()
  }
}
