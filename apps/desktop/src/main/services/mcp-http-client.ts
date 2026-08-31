import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { logger } from '@baishou/shared'
import { APP_VERSION } from '../../app-version'

const CONNECT_TIMEOUT_MS = 12_000

export type McpHttpListedTool = {
  name: string
  description?: string
  inputSchema?: unknown
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('连接超时')), ms)
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
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS)
  } catch (error) {
    await closeMcpHttpClient({ client, transport })
    throw error
  }
  return { client, transport }
}

export async function listMcpHttpTools(client: Client): Promise<McpHttpListedTool[]> {
  const listed = await client.listTools()
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
