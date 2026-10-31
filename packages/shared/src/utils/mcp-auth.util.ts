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

/** 在 MCP 连接地址后拼接 ?vault=<vaultId> 后缀（纯 ASCII 稳定工作空间 ID） */
export function appendMcpVaultQuery(baseUrl: string, vaultId?: string | null): string {
  const trimmed = typeof vaultId === 'string' ? vaultId.trim() : ''
  if (!trimmed) return baseUrl
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}vault=${encodeURIComponent(trimmed)}`
}

/**
 * 从 MCP 请求路径或完整 URL 中解析目标工作空间标识（支持 ?vault= / ?vaultId= / ?workspace= 或 /mcp/:vault / /sse/:vault）。
 */
export function extractMcpTargetVault(pathOrUrl: string | undefined | null): string | undefined {
  const raw = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : ''
  if (!raw) return undefined

  let pathname = raw
  let queryString = ''
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw)
      pathname = parsed.pathname
      queryString = parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search
    } else {
      const qIndex = raw.indexOf('?')
      if (qIndex >= 0) {
        pathname = raw.slice(0, qIndex)
        queryString = raw.slice(qIndex + 1)
      }
    }
  } catch {
    const qIndex = raw.indexOf('?')
    if (qIndex >= 0) {
      pathname = raw.slice(0, qIndex)
      queryString = raw.slice(qIndex + 1)
    }
  }

  if (queryString) {
    const params = new URLSearchParams(queryString)
    const fromQuery = params.get('vault') ?? params.get('vaultId') ?? params.get('workspace')
    if (fromQuery && fromQuery.trim().length > 0) {
      return fromQuery.trim()
    }
  }

  const pathMatch = pathname.match(/^\/(?:mcp|sse)\/([^/]+)\/?$/)
  if (pathMatch?.[1]) {
    try {
      const decoded = decodeURIComponent(pathMatch[1]).trim()
      if (decoded.length > 0) return decoded
    } catch {
      const fallback = pathMatch[1].trim()
      if (fallback.length > 0) return fallback
    }
  }

  return undefined
}
