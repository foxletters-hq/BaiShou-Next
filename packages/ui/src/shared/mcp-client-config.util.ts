/** Cursor / MCP 客户端 mcp.json 配置示例（url + 可选 Bearer 令牌） */
export function buildMcpClientJsonExample(endpointUrl: string, authToken?: string): string {
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
