import type { McpServerConfig } from '../types/settings.types'

function createMcpAuthToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

/** 启用 MCP 时确保存在访问令牌（用于 LAN / 本地鉴权） */
export function ensureMcpAuthToken(config: McpServerConfig): McpServerConfig {
  if (!config.mcpEnabled) return config
  if (config.mcpAuthToken?.trim()) return config
  return { ...config, mcpAuthToken: createMcpAuthToken() }
}

/** 手动刷新访问令牌（需由用户显式触发） */
export function refreshMcpAuthToken(config: McpServerConfig): McpServerConfig {
  return { ...config, mcpAuthToken: createMcpAuthToken() }
}

export function isMcpRequestAuthorized(
  config: McpServerConfig,
  authorizationHeader: string | undefined
): boolean {
  const token = config.mcpAuthToken?.trim()
  if (!token) return true
  return authorizationHeader === `Bearer ${token}`
}
