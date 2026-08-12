export type McpClientJsonTransport = 'streamableHttp' | 'sse'

/** Cursor / MCP 客户端 mcp.json 配置示例 */
export function buildMcpClientJsonExample(
  endpointUrl: string,
  authToken?: string,
  _transport: McpClientJsonTransport = 'streamableHttp'
): string {
  const headersBlock = authToken?.trim()
    ? `,
      "headers": {
        "Authorization": "Bearer ${authToken.trim()}"
      }`
    : ''
  return `{
  "mcpServers": {
    "baishou": {
      "url": "${endpointUrl}"${headersBlock}
    }
  }
}`
}
