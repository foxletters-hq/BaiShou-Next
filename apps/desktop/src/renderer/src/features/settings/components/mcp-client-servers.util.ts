import {
  MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE,
  normalizeMcpStreamableUrl,
  type McpClientProbeReason,
  type McpClientServerStatus
} from '@baishou/shared'

export type McpClientUrlError = Exclude<McpClientProbeReason, 'connect' | 'timeout'>

export const MCP_CLIENT_STATUS_FETCH_TIMEOUT_MS = 20_000

export async function withStatusFetchTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE)), ms)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function newMcpClientServerId(
  randomUUID: (() => string) | null | undefined = globalThis.crypto?.randomUUID?.bind(
    globalThis.crypto
  ),
  now = Date.now(),
  random = Math.random()
): string {
  return randomUUID?.() ?? `mcp-${now}-${random.toString(16).slice(2)}`
}

export function defaultMcpClientNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname || 'MCP'
  } catch {
    return 'MCP'
  }
}

export function parseMcpClientUrl(raw: string): { url: string } | { error: McpClientUrlError } {
  const result = normalizeMcpStreamableUrl(raw)
  if (result.ok === true) return { url: result.url }
  return { error: result.reason }
}

export function mcpClientStatusById(
  statuses: McpClientServerStatus[]
): Map<string, McpClientServerStatus> {
  return new Map(statuses.map((item) => [item.id, item]))
}
