import type { McpServerConfig } from '../types/settings.types'

function createMcpAuthToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

/** 未显式关闭时视为开启鉴权（兼容旧配置） */
export function isMcpAuthEnabled(config: Pick<McpServerConfig, 'mcpAuthEnabled'>): boolean {
  return config.mcpAuthEnabled !== false
}

/** 启用 MCP 且开启鉴权时确保存在访问令牌（用于 LAN / 本地鉴权） */
export function ensureMcpAuthToken(config: McpServerConfig): McpServerConfig {
  if (!config.mcpEnabled) return config
  if (!isMcpAuthEnabled(config)) return config
  if (config.mcpAuthToken?.trim()) return config
  return { ...config, mcpAuthToken: createMcpAuthToken() }
}

/** 手动刷新访问令牌（需由用户显式触发）；同时确保鉴权开启 */
export function refreshMcpAuthToken(config: McpServerConfig): McpServerConfig {
  return {
    ...config,
    mcpAuthEnabled: true,
    mcpAuthToken: createMcpAuthToken()
  }
}

export function isMcpRequestAuthorized(
  config: McpServerConfig,
  authorizationHeader: string | undefined
): boolean {
  if (!isMcpAuthEnabled(config)) return true
  const token = config.mcpAuthToken?.trim()
  if (!token) return true
  return authorizationHeader === `Bearer ${token}`
}
