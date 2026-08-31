import type {
  McpClientConfig,
  McpClientListedTool,
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
