export type McpClientJsonTransport = 'streamableHttp' | 'sse'

export interface McpWorkspaceJsonEntry {
  name: string
  url: string
}

/** Cursor / MCP 客户端 mcp.json 配置示例（url + 可选 Bearer 令牌） */
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

/** 多小窝共存时的 mcp.json 配置示例（展示可在 mcpServers 下同时配置多个小窝） */
export function buildMcpMultiWorkspaceJsonExample(
  entries: McpWorkspaceJsonEntry[],
  fallbackUrl: string,
  authToken?: string,
  transport: McpClientJsonTransport = 'streamableHttp'
): string {
  if (!entries || entries.length <= 1) {
    const singleUrl = entries?.[0]?.url || fallbackUrl
    return buildMcpClientJsonExample(singleUrl, authToken, transport)
  }
  const headersBlock = authToken?.trim()
    ? `,
      "headers": {
        "Authorization": "Bearer ${authToken.trim()}"
      }`
    : ''
  const usedKeys = new Set<string>()
  const blocks = entries.map((entry, idx) => {
    const safeSuffix = entry.name.trim().replace(/["\\\r\n]+/g, '_') || String(idx + 1)
    let serverKey = `baishou-${safeSuffix}`
    if (usedKeys.has(serverKey)) {
      serverKey = `${serverKey}-${idx + 1}`
    }
    usedKeys.add(serverKey)
    return `    "${serverKey}": {
      "url": "${entry.url}"${headersBlock}
    }`
  })
  return `{
  "mcpServers": {
${blocks.join(',\n')}
  }
}`
}
