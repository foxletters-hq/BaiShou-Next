/** Primary MCP URL (Streamable HTTP). */
export function buildMcpUrl(port: number, host = '127.0.0.1'): string {
  return `http://${host}:${port}/mcp`
}

/** Legacy SSE MCP endpoint URL. */
export function buildMcpSseUrl(port: number, host = '127.0.0.1'): string {
  return `http://${host}:${port}/sse`
}
