import { sanitizeMcpClientConfig, type McpClientConfig } from '@baishou/shared'
import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync
} from './mobile-sandbox-fs'

export const MOBILE_MCP_CLIENT_CONFIG_FILE = 'device_mcp_client_config.json'

export type MobileMcpClientConfigIo = {
  resolvePath: () => string
  exists: (uri: string) => Promise<boolean>
  read: (uri: string) => Promise<string>
  write: (uri: string, contents: string) => Promise<void>
}

const defaultIo: MobileMcpClientConfigIo = {
  resolvePath: () => `${documentDirectory}${MOBILE_MCP_CLIENT_CONFIG_FILE}`,
  exists: async (uri) => (await getInfoAsync(uri)).exists,
  read: (uri) => readAsStringAsync(uri),
  write: (uri, contents) => writeAsStringAsync(uri, contents)
}

export function resolveMobileMcpClientConfigPath(
  io: MobileMcpClientConfigIo = defaultIo
): string {
  return io.resolvePath()
}

export async function getMobileMcpClientConfig(
  io: MobileMcpClientConfigIo = defaultIo
): Promise<McpClientConfig> {
  const path = io.resolvePath()
  if (!(await io.exists(path))) {
    return { servers: [] }
  }
  return sanitizeMcpClientConfig(JSON.parse(await io.read(path)))
}

export async function setMobileMcpClientConfig(
  config: McpClientConfig,
  io: MobileMcpClientConfigIo = defaultIo
): Promise<McpClientConfig> {
  const next = sanitizeMcpClientConfig(config)
  await io.write(io.resolvePath(), JSON.stringify(next, null, 2))
  return next
}
