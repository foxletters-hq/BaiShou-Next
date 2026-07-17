import { ipcMain } from 'electron'
import {
  LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY,
  LEGACY_UPGRADE_RAG_PENDING_KEY
} from '@baishou/core/shared'
import { resolveWebSearchEnabled, BAISHOU_AGENT_GATE_CONFIG_KEY } from '@baishou/shared'
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

  ipcMain.handle('settings:get-baishou-agent-gate-config', async () => {
    const { getAgentGateConfig } = await import('../services/agent-gate.service')
    return getAgentGateConfig()
  })

  ipcMain.handle('settings:set-baishou-agent-gate-config', async (_, config: any) => {
    const { ensureAgentGateRuntime } = await import('../services/agent-gate.service')
    const { AgentGateEffect } = await import('@baishou/shared')
    const rt = await ensureAgentGateRuntime()
    const next = rt.getConfig()
    if (config?.trustMode !== undefined) next.trustMode = config.trustMode
    if (Array.isArray(config?.allowlist)) {
      next.allowlist = config.allowlist
        .filter(
          (entry: unknown): entry is {
            id: string
            action: string
            createdAt: number
            pattern?: string
            resourceKind?: string
          } =>
            !!entry &&
            typeof entry === 'object' &&
            typeof (entry as { id?: unknown }).id === 'string' &&
            typeof (entry as { action?: unknown }).action === 'string' &&
            typeof (entry as { createdAt?: unknown }).createdAt === 'number'
        )
        .map((entry: {
          id: string
          action: string
          createdAt: number
          pattern?: string
          resourceKind?: string
          sourceSessionId?: string
          sourceRequestId?: string
        }) => {
          const action = entry.action.trim()
          const pattern =
            typeof entry.pattern === 'string' && entry.pattern.trim()
              ? entry.pattern.trim()
              : undefined
          // workspace_run must never be whole-action allowlisted
          if (action === 'workspace_run' && !pattern) return null
          if (pattern === '*' || pattern === '* *' || pattern === '**') return null
          return {
            id: entry.id,
            action,
            createdAt: entry.createdAt,
            ...(pattern
              ? {
                  pattern,
                  resourceKind:
                    entry.resourceKind === 'shell_command' ||
                    entry.resourceKind === 'workspace_path' ||
                    entry.resourceKind === 'file_path' ||
                    entry.resourceKind === 'external_path'
                      ? entry.resourceKind
                      : action === 'workspace_run'
                        ? ('shell_command' as const)
                        : undefined
                }
              : {}),
            ...(typeof entry.sourceSessionId === 'string'
              ? { sourceSessionId: entry.sourceSessionId }
              : {}),
            ...(typeof entry.sourceRequestId === 'string'
              ? { sourceRequestId: entry.sourceRequestId }
              : {})
          }
        })
        .filter(Boolean)
    }
    if (Array.isArray(config?.exclusionList)) {
      next.exclusionList = config.exclusionList
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim())
        .filter(Boolean)
    }
    const allowedEffects = new Set([
      AgentGateEffect.Allow,
      AgentGateEffect.Ask,
      AgentGateEffect.Deny
    ])
    if (Array.isArray(config?.permissionRules)) {
      next.permissionRules = config.permissionRules
        .filter(
          (rule: unknown): rule is { action: string; effect: string; pattern?: string } =>
            !!rule &&
            typeof rule === 'object' &&
            typeof (rule as { action?: unknown }).action === 'string' &&
            typeof (rule as { effect?: unknown }).effect === 'string' &&
            allowedEffects.has((rule as { effect: string }).effect as never)
        )
        .map((rule: { action: string; effect: string; pattern?: string }) => ({
          action: rule.action.trim(),
          effect: rule.effect as (typeof AgentGateEffect)[keyof typeof AgentGateEffect],
          ...(typeof rule.pattern === 'string' && rule.pattern.trim()
            ? { pattern: rule.pattern.trim() }
            : {})
        }))
        .filter((rule: { action: string; effect: string; pattern?: string }) => {
          if (!rule.action) return false
          // Reject silent whole-action Allow for host commands
          if (
            rule.action === 'workspace_run' &&
            rule.effect === AgentGateEffect.Allow &&
            !rule.pattern
          ) {
            return false
          }
          if (rule.pattern === '*' || rule.pattern === '**' || rule.pattern === '**/*') {
            return false
          }
          return true
        })
    }
    if (typeof config?.hideDeniedTools === 'boolean') {
      next.hideDeniedTools = config.hideDeniedTools
    }
    if (typeof config?.forceAskExternalPath === 'boolean') {
      next.forceAskExternalPath = config.forceAskExternalPath
    }
    if (
      typeof config?.repeatAssertAskThreshold === 'number' &&
      Number.isFinite(config.repeatAssertAskThreshold) &&
      config.repeatAssertAskThreshold >= 0
    ) {
      next.repeatAssertAskThreshold = Math.floor(config.repeatAssertAskThreshold)
    }
    await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, next)
    return next
  })

  ipcMain.handle('settings:get-search-mode-enabled', async () => {
    const stored = await settingsManager.get<boolean>('search_mode_enabled')
    return resolveWebSearchEnabled(undefined, stored)
  })

  ipcMain.handle('settings:set-search-mode-enabled', async (_, enabled: boolean) => {
    await settingsManager.set('search_mode_enabled', enabled)
    return true
  })

  ipcMain.handle('settings:get-mcp-server-config', async () => {
    const { getDesktopMcpServerConfig } = await import('../services/desktop-mcp-config.store')
    return getDesktopMcpServerConfig()
  })

  ipcMain.handle('settings:set-mcp-server-config', async (_, config: any) => {
    const { ensureMcpAuthToken } = await import('@baishou/shared')
    const nextConfig = ensureMcpAuthToken(config)
    const { SettingsRepository } = await import('@baishou/database-desktop')
    const { getAppDb } = await import('../db')
    const { setDesktopMcpServerConfig } = await import('../services/desktop-mcp-config.store')
    const settingsRepo = new SettingsRepository(getAppDb())
    await setDesktopMcpServerConfig(nextConfig, settingsRepo, () => settingsManager.flushToDisk())
    const { applyMcpServerConfig } = await import('../services/mcp-runtime')
    await applyMcpServerConfig(nextConfig)
    return nextConfig
  })

  ipcMain.handle('settings:refresh-mcp-auth-token', async () => {
    const { refreshDesktopMcpAuthToken, setDesktopMcpServerConfig } =
      await import('../services/desktop-mcp-config.store')
    const { SettingsRepository } = await import('@baishou/database-desktop')
    const { getAppDb } = await import('../db')
    const nextConfig = await refreshDesktopMcpAuthToken()
    const settingsRepo = new SettingsRepository(getAppDb())
    await setDesktopMcpServerConfig(nextConfig, settingsRepo, () => settingsManager.flushToDisk())
    const { applyMcpServerConfig } = await import('../services/mcp-runtime')
    await applyMcpServerConfig(nextConfig)
    return nextConfig
  })

  ipcMain.handle('settings:get-mcp-lan-ip', async () => {
    const { getDesktopLanIpv4 } = await import('../services/desktop-lan-ip.util')
    return getDesktopLanIpv4()
  })

  ipcMain.handle('settings:get-mcp-tools', async () => {
    const { toolRegistry, buildMcpToolContext } = await import('./agent-helpers')
    const { listBaishouMcpExposedTools } = await import('@baishou/ai')
    const { logger } = await import('@baishou/shared')
    if (!toolRegistry) return []
    try {
      const context = await buildMcpToolContext()
      return listBaishouMcpExposedTools(toolRegistry, context)
    } catch (e) {
      logger.warn('[settings:get-mcp-tools] Failed to list MCP tools:', e as Error)
      return []
    }
  })

  ipcMain.handle('settings:get-hotkey-config', async () => {
    const { getDesktopHotkeyConfig } = await import('../services/desktop-hotkey-config.store')
    return getDesktopHotkeyConfig()
  })

  ipcMain.handle('settings:set-hotkey-config', async (_, config: any) => {
    const { SettingsRepository } = await import('@baishou/database-desktop')
    const { getAppDb } = await import('../db')
    const { setDesktopHotkeyConfig } = await import('../services/desktop-hotkey-config.store')
    const settingsRepo = new SettingsRepository(getAppDb())
    await setDesktopHotkeyConfig(config, settingsRepo, () => settingsManager.flushToDisk())
    const { getHotkeyService } = await import('./settings.ipc')
    const service = getHotkeyService()
    const registered = service ? service.update(config) : null
    return { ok: registered !== false, registered }
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
    const shownCount = await settingsManager.get<number>(
      LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY as never
    )
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
