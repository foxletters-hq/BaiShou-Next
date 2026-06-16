import { ipcMain } from 'electron'
import {
  LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY,
  LEGACY_UPGRADE_RAG_PENDING_KEY
} from '@baishou/core/shared'
import { settingsManager } from './settings.ipc'

/**
 * 注册与应用全局设置相关的 IPC 通道
 */
export function registerSettingsAppIPC() {
  ipcMain.handle('settings:get-features', async () => {
    return (await settingsManager.get<Record<string, any>>('feature_settings')) || null
  })

  ipcMain.handle('settings:set-features', async (_, config: Record<string, any>) => {
    await settingsManager.set('feature_settings', config)
    return true
  })

  ipcMain.handle('settings:get-agent-behavior-config', async () => {
    return (await settingsManager.get<any>('agent_behavior')) || null
  })

  ipcMain.handle('settings:set-agent-behavior-config', async (_, config: any) => {
    await settingsManager.set('agent_behavior', config)
    return true
  })

  ipcMain.handle('settings:get-rag-config', async () => {
    return (await settingsManager.get<any>('rag_config')) || null
  })

  ipcMain.handle('settings:set-rag-config', async (_, config: any) => {
    await settingsManager.set('rag_config', config)
    return true
  })

  ipcMain.handle('settings:get-web-search-config', async () => {
    return (await settingsManager.get<any>('web_search_config')) || null
  })

  ipcMain.handle('settings:set-web-search-config', async (_, config: any) => {
    await settingsManager.set('web_search_config', config)
    return true
  })

  ipcMain.handle('settings:get-summary-config', async () => {
    return (await settingsManager.get<any>('summary_config')) || null
  })

  ipcMain.handle('settings:set-summary-config', async (_, config: any) => {
    await settingsManager.set('summary_config', config)
    return true
  })

  ipcMain.handle('settings:get-diary-template-config', async () => {
    return (await settingsManager.get<any>('diary_template_config')) || null
  })

  ipcMain.handle('settings:set-diary-template-config', async (_, config: any) => {
    await settingsManager.set('diary_template_config', config)
    return true
  })

  ipcMain.handle('settings:get-tool-management-config', async () => {
    return (await settingsManager.get<any>('tool_management_config')) || null
  })

  ipcMain.handle('settings:set-tool-management-config', async (_, config: any) => {
    await settingsManager.set('tool_management_config', config)
    return true
  })

  ipcMain.handle('settings:get-search-mode-enabled', async () => {
    return (await settingsManager.get<boolean>('search_mode_enabled')) || false
  })

  ipcMain.handle('settings:set-search-mode-enabled', async (_, enabled: boolean) => {
    await settingsManager.set('search_mode_enabled', enabled)
    return true
  })

  ipcMain.handle('settings:get-mcp-server-config', async () => {
    return (await settingsManager.get<any>('mcp_server_config')) || null
  })

  ipcMain.handle('settings:set-mcp-server-config', async (_, config: any) => {
    const { ensureMcpAuthToken } = await import('@baishou/shared')
    const nextConfig = ensureMcpAuthToken(config)
    await settingsManager.set('mcp_server_config', nextConfig)
    const { applyMcpServerConfig } = await import('../services/mcp-runtime')
    await applyMcpServerConfig(nextConfig)
    return nextConfig
  })

  ipcMain.handle('settings:get-mcp-tools', async () => {
    const { toolRegistry, buildMcpToolContext } = await import('./agent-helpers')
    if (!toolRegistry) return []
    const context = await buildMcpToolContext()
    const tools = toolRegistry.getEnabledToolsRaw(context)
    return tools.map((tool: any) => ({
      name: `baishou_${tool.name}`,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category
    }))
  })

  ipcMain.handle('settings:get-hotkey-config', async () => {
    return (await settingsManager.get<any>('hotkey_config')) || null
  })

  ipcMain.handle('settings:set-hotkey-config', async (_, config: any) => {
    await settingsManager.set('hotkey_config', config)
    const { getHotkeyService } = await import('./settings.ipc')
    const service = getHotkeyService()
    if (service) {
      service.update(config)
    }
    return true
  })

  ipcMain.handle('settings:get-cloud-sync-config', async () => {
    return (await settingsManager.get<any>('cloud_sync_config')) || null
  })

  ipcMain.handle('settings:set-cloud-sync-config', async (_, config: any) => {
    await settingsManager.set('cloud_sync_config', config)
    return true
  })

  ipcMain.handle('settings:get-tool-config-value', async (_, key: string) => {
    const toolConfigs = (await settingsManager.get<Record<string, unknown>>('tool_configs')) || {}
    return toolConfigs[key]
  })

  ipcMain.handle('settings:set-tool-config-value', async (_, key: string, value: unknown) => {
    const toolConfigs = (await settingsManager.get<Record<string, unknown>>('tool_configs')) || {}
    toolConfigs[key] = value
    await settingsManager.set('tool_configs', toolConfigs)
    return true
  })

  ipcMain.handle('settings:get-legacy-upgrade-notice-state', async () => {
    const pending = await settingsManager.get<boolean>(LEGACY_UPGRADE_RAG_PENDING_KEY as never)
    const shownCount = await settingsManager.get<number>(LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY as never)
    return {
      pending: pending === true,
      shownCount: typeof shownCount === 'number' ? shownCount : 0
    }
  })

  ipcMain.handle('settings:mark-legacy-upgrade-notice-shown', async () => {
    const shownCount =
      (await settingsManager.get<number>(LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY as never)) ?? 0
    const next = shownCount + 1
    await settingsManager.set(LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY as never, next as never)
    return next
  })
}
