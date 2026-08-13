/** Primary MCP URL (Streamable HTTP). */
export function buildMcpUrl(port: number, host = '127.0.0.1'): string {
  return `http://${host}:${port}/mcp`
}

/** Legacy SSE transport endpoint (`GET /sse` + `POST /message`). */
export function buildMcpSseUrl(port: number, host = '127.0.0.1'): string {
  return `http://${host}:${port}/sse`
}
