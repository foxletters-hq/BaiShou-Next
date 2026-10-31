import type { McpServerConfig } from '@baishou/shared'
import { logger } from '@baishou/shared'
import { getDesktopMcpServerConfig } from './desktop-mcp-config.store'
import { toolRegistry } from '../ipc/agent-helpers'
import { McpService } from './mcp.service'

let mcpService: McpService | null = null
let lastApplied: McpServerConfig | null = null
let activeLifecyclePromise: Promise<void> | null = null
let ensureAlivePromise: Promise<void> | null = null

function ensureMcpService(): McpService {
  if (!mcpService) {
    mcpService = new McpService(toolRegistry)
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

  const run = async (): Promise<void> => {
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

  const task = activeLifecyclePromise ? activeLifecyclePromise.catch(() => {}).then(run) : run()
  activeLifecyclePromise = task
  try {
    await task
  } finally {
    if (activeLifecyclePromise === task) {
      activeLifecyclePromise = null
    }
  }
}

/** Start MCP on app boot when enabled in settings. */
export async function bootstrapMcpServer(): Promise<void> {
  const config = await getDesktopMcpServerConfig()
  ensureMcpService()
  await applyMcpServerConfig(config)
}

/**
 * 幂等自愈保活：当配置中 mcpEnabled 为 true 但底层服务未处于真实监听状态时，自动重新拉起。
 */
export async function ensureMcpServerAlive(): Promise<void> {
  if (ensureAlivePromise) {
    return ensureAlivePromise
  }

  ensureAlivePromise = (async () => {
    try {
      if (activeLifecyclePromise) {
        await activeLifecyclePromise.catch(() => {})
      }
      const config = await getDesktopMcpServerConfig()
      if (!config.mcpEnabled) return

      const service = ensureMcpService()
      if (service.running) return

      logger.warn(
        `[McpRuntime] MCP server is enabled but not listening on port ${config.mcpPort}; triggering self-heal`
      )
      await applyMcpServerConfig(config)
    } catch (e) {
      logger.warn('[McpRuntime] ensureMcpServerAlive failed:', e as Error)
    } finally {
      ensureAlivePromise = null
    }
  })()

  return ensureAlivePromise
}

export async function shutdownMcpServer(): Promise<void> {
  if (activeLifecyclePromise) {
    await activeLifecyclePromise.catch(() => {})
  }
  if (mcpService) {
    await mcpService.stop()
  }
  lastApplied = null
}

export function getMcpService(): McpService | null {
  return mcpService
}
