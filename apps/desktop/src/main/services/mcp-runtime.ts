import type { McpServerConfig } from '@baishou/shared'
import { SettingsRepository } from '@baishou/database-desktop'
import { logger } from '@baishou/shared'
import { getAppDb } from '../db'
import { toolRegistry } from '../ipc/agent-helpers'
import { McpService } from './mcp.service'

let mcpService: McpService | null = null
let lastApplied: McpServerConfig | null = null

function ensureMcpService(): McpService {
  if (!mcpService) {
    const settingsRepo = new SettingsRepository(getAppDb())
    mcpService = new McpService(settingsRepo, toolRegistry)
  }
  return mcpService
}

/** Apply MCP server lifecycle from settings (start / stop / restart on port change). */
export async function applyMcpServerConfig(config: McpServerConfig): Promise<void> {
  const service = ensureMcpService()

  const sameAsLast =
    lastApplied !== null &&
    lastApplied.mcpEnabled === config.mcpEnabled &&
    lastApplied.mcpPort === config.mcpPort

  if (!config.mcpEnabled) {
    if (service.running) {
      await service.stop()
      logger.info('[McpRuntime] MCP server stopped (disabled in settings)')
    }
    lastApplied = { ...config }
    return
  }

  if (sameAsLast && service.running) {
    return
  }

  try {
    if (service.running) {
      await service.restart()
      logger.info(`[McpRuntime] MCP server restarted on port ${config.mcpPort}`)
    } else {
      await service.start()
      logger.info(`[McpRuntime] MCP server started on port ${config.mcpPort}`)
    }
    lastApplied = { ...config }
  } catch (e) {
    logger.error('[McpRuntime] Failed to apply MCP server config:', e as any)
    throw e
  }
}

/** Start MCP on app boot when enabled in settings. */
export async function bootstrapMcpServer(): Promise<void> {
  const settingsRepo = new SettingsRepository(getAppDb())
  const config = await settingsRepo.getMcpServerConfig()
  ensureMcpService()
  await applyMcpServerConfig(config)
}

export async function shutdownMcpServer(): Promise<void> {
  if (mcpService?.running) {
    await mcpService.stop()
  }
  lastApplied = null
}

export function getMcpService(): McpService | null {
  return mcpService
}
