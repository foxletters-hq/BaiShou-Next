import { app } from 'electron'
import * as fsp from 'fs/promises'
import { join } from 'path'
import type { SettingsRepository } from '@baishou/database-desktop'
import { DEFAULT_MCP_SERVER_CONFIG } from '@baishou/database-desktop'
import type { McpServerConfig } from '@baishou/shared'
import { isDesktopDevBuild } from '../app-identity'

export const DESKTOP_MCP_CONFIG_FILE = 'device_mcp_server_config.json'
export const MCP_CONFIG_SETTINGS_KEY = 'mcp_server_config'

/** 开发端默认 MCP 端口，避免与稳定版 31004 同时运行时冲突 */
export const DESKTOP_DEV_DEFAULT_MCP_PORT = 31005

export interface DesktopMcpConfigReader {
  getMcpServerConfig(): Promise<McpServerConfig>
}

function configPath(): string {
  return join(app.getPath('userData'), DESKTOP_MCP_CONFIG_FILE)
}

function defaultMcpConfig(): McpServerConfig {
  if (!isDesktopDevBuild()) {
    return { ...DEFAULT_MCP_SERVER_CONFIG }
  }
  return {
    ...DEFAULT_MCP_SERVER_CONFIG,
    mcpPort: DESKTOP_DEV_DEFAULT_MCP_PORT
  }
}

function isValidMcpConfig(value: unknown): value is McpServerConfig {
  if (!value || typeof value !== 'object') return false
  const cfg = value as McpServerConfig
  return typeof cfg.mcpEnabled === 'boolean' && typeof cfg.mcpPort === 'number'
}

async function readLocalConfig(): Promise<McpServerConfig | null> {
  try {
    const raw = await fsp.readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as McpServerConfig
    if (isValidMcpConfig(parsed)) {
      return parsed
    }
  } catch (e: any) {
    if (e?.code !== 'ENOENT') {
      throw e
    }
  }
  return null
}

async function writeLocalConfig(config: McpServerConfig): Promise<void> {
  await fsp.mkdir(app.getPath('userData'), { recursive: true })
  await fsp.writeFile(configPath(), JSON.stringify(config, null, 2), 'utf8')
}

async function removeLegacySharedConfig(settingsRepo: SettingsRepository): Promise<void> {
  const legacy = await settingsRepo.get(MCP_CONFIG_SETTINGS_KEY)
  if (legacy === null || legacy === undefined) return
  await settingsRepo.delete(MCP_CONFIG_SETTINGS_KEY)
}

/**
 * 将历史上写入共享 Agent DB / vault settings 的 MCP 配置迁移到本机 userData。
 * 迁移时丢弃共享访问令牌，各安装实例在启用 MCP 时各自生成令牌。
 */
export async function migrateDesktopMcpConfigFromSharedSettings(
  settingsRepo: SettingsRepository,
  flushSharedSettings?: () => Promise<void>
): Promise<void> {
  if (await readLocalConfig()) return

  const legacy = await settingsRepo.get<McpServerConfig>(MCP_CONFIG_SETTINGS_KEY)
  if (!legacy) return

  const { mcpAuthToken: _sharedToken, ...withoutToken } = legacy
  await writeLocalConfig(withoutToken)
  await settingsRepo.delete(MCP_CONFIG_SETTINGS_KEY)
  if (flushSharedSettings) {
    await flushSharedSettings()
  }
}

export async function getDesktopMcpServerConfig(): Promise<McpServerConfig> {
  return (await readLocalConfig()) ?? defaultMcpConfig()
}

export async function setDesktopMcpServerConfig(
  config: McpServerConfig,
  settingsRepo?: SettingsRepository,
  flushSharedSettings?: () => Promise<void>
): Promise<void> {
  await writeLocalConfig(config)
  if (settingsRepo) {
    await removeLegacySharedConfig(settingsRepo)
    if (flushSharedSettings) {
      await flushSharedSettings()
    }
  }
}

export const desktopMcpConfigReader: DesktopMcpConfigReader = {
  getMcpServerConfig: getDesktopMcpServerConfig
}
