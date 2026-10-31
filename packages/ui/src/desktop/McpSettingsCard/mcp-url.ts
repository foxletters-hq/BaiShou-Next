import { appendMcpVaultQuery } from '@baishou/shared'

/** Primary MCP URL (Streamable HTTP). */
export function buildMcpUrl(port: number, host = '127.0.0.1', vaultId?: string | null): string {
  return appendMcpVaultQuery(`http://${host}:${port}/mcp`, vaultId)
}

/** Legacy SSE transport endpoint (`GET /sse` + `POST /message`). */

export function buildMcpSseUrl(port: number, host = '127.0.0.1', vaultId?: string | null): string {
  return appendMcpVaultQuery(`http://${host}:${port}/sse`, vaultId)
}
