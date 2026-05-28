/** Primary MCP URL for Cursor (Streamable HTTP). */
export function buildMcpUrl(port: number): string {
  return `http://127.0.0.1:${port}/mcp`
}

/** @deprecated Legacy SSE endpoint; prefer {@link buildMcpUrl}. */
export function buildMcpSseUrl(port: number): string {
  return `${buildMcpUrl(port).replace(/\/mcp$/, '')}/sse`
}
