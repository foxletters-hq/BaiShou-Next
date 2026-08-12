import type { McpServerConfig } from '../types/settings.types'

function createMcpAuthToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

/** 是否启用 MCP 访问令牌鉴权（默认关闭） */
export function isMcpAuthEnabled(config: Pick<McpServerConfig, 'mcpAuthEnabled'>): boolean {
  return config.mcpAuthEnabled === true
}

/** 鉴权开启且 MCP 启用时确保存在访问令牌 */
export function ensureMcpAuthToken(config: McpServerConfig): McpServerConfig {
  if (!config.mcpEnabled || !isMcpAuthEnabled(config)) return config
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
  if (!isMcpAuthEnabled(config)) return true
  const token = config.mcpAuthToken?.trim()
  if (!token) return true
  return authorizationHeader === `Bearer ${token}`
}
