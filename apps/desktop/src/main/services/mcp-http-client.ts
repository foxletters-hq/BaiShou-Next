import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { logger } from '@baishou/shared'
import { APP_VERSION } from '../../app-version'

export const MCP_HTTP_CONNECT_TIMEOUT_MS = 12_000
export const MCP_HTTP_LIST_TOOLS_TIMEOUT_MS = 12_000
export const MCP_HTTP_PROBE_TIMEOUT_MS = 15_000

export type McpHttpListedTool = {
  name: string
  description?: string
  inputSchema?: unknown
}

export async function withMcpHttpTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = '连接超时'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function connectMcpHttpClient(params: {
  url: string
  authToken?: string
}): Promise<{
  client: Client
  transport: StreamableHTTPClientTransport
}> {
  const headers: Record<string, string> = {}
  const token = params.authToken?.trim()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const transport = new StreamableHTTPClientTransport(new URL(params.url), {
    requestInit: Object.keys(headers).length > 0 ? { headers } : undefined
  })
  const client = new Client({ name: 'baishou', version: APP_VERSION })
  try {
    await withMcpHttpTimeout(client.connect(transport), MCP_HTTP_CONNECT_TIMEOUT_MS, '连接超时')
  } catch (error) {
    await closeMcpHttpClient({ client, transport })
    throw error
  }
  return { client, transport }
}

export async function listMcpHttpTools(
  client: Client,
  timeoutMs = MCP_HTTP_LIST_TOOLS_TIMEOUT_MS
): Promise<McpHttpListedTool[]> {
  const listed = await withMcpHttpTimeout(client.listTools(), timeoutMs, '获取工具超时')
  return (listed.tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
}

export async function callMcpHttpTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return client.callTool({ name, arguments: args })
}

export async function closeMcpHttpClient(params: {
  client: Client
  transport: StreamableHTTPClientTransport
}): Promise<void> {
  try {
    await params.client.close()
  } catch (error) {
    logger.warn('[mcp-http-client] close client failed', error as Error)
  }
  try {
    await params.transport.close()
  } catch (error) {
    logger.warn('[mcp-http-client] close transport failed', error as Error)
  }
}
