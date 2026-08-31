import { app } from 'electron'
import * as fsp from 'fs/promises'
import { join } from 'path'
import { sanitizeMcpClientConfig, type McpClientConfig } from '@baishou/shared'

const DESKTOP_MCP_CLIENT_CONFIG_FILE = 'device_mcp_client_config.json'

function configPath(): string {
  return join(app.getPath('userData'), DESKTOP_MCP_CLIENT_CONFIG_FILE)
}

export async function getDesktopMcpClientConfig(): Promise<McpClientConfig> {
  try {
    const raw = await fsp.readFile(configPath(), 'utf8')
    return sanitizeMcpClientConfig(JSON.parse(raw))
  } catch (error: unknown) {
    const code = (error as { code?: string } | null)?.code
    if (code !== 'ENOENT') {
      throw error
    }
  }
  return { servers: [] }
}

export async function setDesktopMcpClientConfig(config: McpClientConfig): Promise<McpClientConfig> {
  const next = sanitizeMcpClientConfig(config)
  await fsp.mkdir(app.getPath('userData'), { recursive: true })
  await fsp.writeFile(configPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
