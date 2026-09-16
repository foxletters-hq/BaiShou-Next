import type {
  McpClientConfig,
  McpClientListedTool,
  McpClientProbeReason,
  McpClientServerEntry,
  McpClientServerStatus
} from '../types/settings.types'

export type NormalizeMcpStreamableUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'sse' }

function stripTrailingSlashes(path: string): string {
  return path.replace(/\/+$/, '')
}

/**
 * 只接受 Streamable HTTP 的 /mcp 地址。
 * 无路径时补上 /mcp；路径为 /sse 时拒绝。
 */
export function normalizeMcpStreamableUrl(raw: string): NormalizeMcpStreamableUrlResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'invalid' }
  }

  const path = stripTrailingSlashes(parsed.pathname || '')
  if (path === '/sse' || path.endsWith('/sse')) {
    return { ok: false, reason: 'sse' }
  }

  if (!path || path === '/') {
    parsed.pathname = '/mcp'
  } else if (!/\/mcp$/i.test(path)) {
    return { ok: false, reason: 'invalid' }
  } else {
    parsed.pathname = path
  }

  parsed.hash = ''
  return { ok: true, url: parsed.toString() }
}

export function sanitizeMcpNamePart(raw: string, maxLen: number): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const fallback = cleaned || 'mcp'
  return fallback.slice(0, maxLen)
}

export function buildExternalMcpToolId(serverId: string, toolName: string): string {
  return `mcp_${sanitizeMcpNamePart(serverId, 24)}_${sanitizeMcpNamePart(toolName, 48)}`
}

/** 旧式 Anthropic 前缀：mcp__server__tool */
const MCP_ANTHROPIC_PREFIX = /^mcp__[^_]+__/
/** buildExternalMcpToolId 在 serverId 为 UUID 时留下的 8_4_4_4 段 */
const MCP_SANITIZED_UUID_PREFIX =
  /^mcp_([0-9a-fA-F]{8}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4})_+(.*)$/

/** 从注册用工具编号里取出远端工具名，去掉服务端随机 id */
export function extractExternalMcpRemoteToolName(rawName: string): string | null {
  const name = rawName.trim()
  if (!name) return null

  if (MCP_ANTHROPIC_PREFIX.test(name)) {
    const stripped = name.replace(MCP_ANTHROPIC_PREFIX, '').trim()
    return stripped || null
  }

  const uuidMatch = name.match(MCP_SANITIZED_UUID_PREFIX)
  if (uuidMatch?.[2]) return uuidMatch[2]

  if (name.startsWith('mcp_')) {
    const baishouAt = name.indexOf('baishou_')
    if (baishouAt > 3) return name.slice(baishouAt)
  }

  return null
}

export function resolveMcpToolLookupName(rawName: string): {
  isMcp: boolean
  lookupName: string
} {
  const trimmed = rawName.trim()
  const extracted = extractExternalMcpRemoteToolName(trimmed)
  if (extracted) {
    return { isMcp: true, lookupName: extracted }
  }
  if (trimmed.startsWith('mcp_') || trimmed.startsWith('mcp__')) {
    const rest = trimmed.replace(/^mcp_+/, '')
    return { isMcp: true, lookupName: rest || trimmed }
  }
  return { isMcp: false, lookupName: trimmed }
}

export function formatMcpClientToolResult(result: unknown): string {
  if (result == null) return ''
  if (typeof result === 'string') return result

  const record = result as {
    isError?: boolean
    content?: Array<{ type?: string; text?: string }>
  }
  const texts = (record.content ?? [])
    .map((item) => {
      if (item?.type === 'text' && typeof item.text === 'string') return item.text
      if (typeof item?.text === 'string') return item.text
      return ''
    })
    .filter(Boolean)
  const body = texts.join('\n').trim() || JSON.stringify(result)
  if (record.isError) return `Error: ${body}`
  return body
}

export function sanitizeMcpClientServerEntry(raw: unknown): McpClientServerEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<McpClientServerEntry>
  if (typeof row.id !== 'string' || !row.id.trim()) return null
  if (typeof row.name !== 'string' || !row.name.trim()) return null
  if (typeof row.url !== 'string') return null
  const normalized = normalizeMcpStreamableUrl(row.url)
  if (!normalized.ok) return null
  return {
    id: row.id.trim(),
    name: row.name.trim(),
    url: normalized.url,
    enabled: row.enabled !== false,
    authToken: typeof row.authToken === 'string' && row.authToken.trim() ? row.authToken : undefined
  }
}

export function toMcpClientListedTools(tools: unknown): McpClientListedTool[] {
  if (!Array.isArray(tools)) return []
  const listed: McpClientListedTool[] = []
  for (const item of tools) {
    if (typeof item === 'string' && item.trim()) {
      listed.push({ name: item.trim() })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const name = (item as { name?: unknown }).name
    if (typeof name !== 'string' || !name.trim()) continue
    const description = (item as { description?: unknown }).description
    listed.push({
      name: name.trim(),
      description: typeof description === 'string' && description.trim() ? description.trim() : undefined
    })
  }
  return listed
}

export function isMcpClientTimeoutMessage(message: string | undefined): boolean {
  if (!message?.trim()) return false
  return message.includes('超时') || /timed?\s*out/i.test(message)
}

export function mcpClientProbeReasonFromError(error: unknown): Extract<
  McpClientProbeReason,
  'timeout' | 'connect'
> {
  const message = error instanceof Error ? error.message : String(error)
  return isMcpClientTimeoutMessage(message) ? 'timeout' : 'connect'
}

export type McpClientCardStatusKind =
  | 'disabled'
  | 'connected'
  | 'loading'
  | 'timeout'
  | 'disconnected'

export function resolveMcpClientCardStatusKind(input: {
  enabled: boolean
  connected: boolean
  loading: boolean
  timedOut: boolean
}): McpClientCardStatusKind {
  if (!input.enabled) return 'disabled'
  if (input.connected) return 'connected'
  if (input.loading) return 'loading'
  if (input.timedOut) return 'timeout'
  return 'disconnected'
}

export function upsertMcpClientServerStatus(
  statuses: McpClientServerStatus[],
  next: McpClientServerStatus
): McpClientServerStatus[] {
  const index = statuses.findIndex((item) => item.id === next.id)
  if (index < 0) return [...statuses, next]
  const copy = [...statuses]
  copy[index] = next
  return copy
}

export function sanitizeMcpClientConfig(raw: unknown): McpClientConfig {
  if (!raw || typeof raw !== 'object') return { servers: [] }
  const servers = Array.isArray((raw as McpClientConfig).servers)
    ? (raw as McpClientConfig).servers
    : []
  const seen = new Set<string>()
  const next: McpClientServerEntry[] = []
  for (const item of servers) {
    const entry = sanitizeMcpClientServerEntry(item)
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    next.push(entry)
  }
  return { servers: next }
}
