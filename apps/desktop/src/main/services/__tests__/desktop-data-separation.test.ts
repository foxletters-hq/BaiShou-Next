import { describe, it, expect, vi } from 'vitest'
import { join } from 'path'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock/userData'),
    setName: vi.fn(),
    setPath: vi.fn()
  }
}))

import {
  DESKTOP_APP_NAME,
  DESKTOP_DEV_APP_NAME,
  DESKTOP_APP_ID,
  DESKTOP_DEV_APP_ID
} from '../../app-identity'
import { DESKTOP_HOTKEY_CONFIG_FILE } from '../desktop-hotkey-config.store'
import {
  DESKTOP_MCP_CONFIG_FILE,
  DESKTOP_DEV_DEFAULT_MCP_PORT
} from '../desktop-mcp-config.store'
import { DESKTOP_DEVICE_LOCAL_AGENT_DB_KEYS } from '../desktop-device-settings.util'

/**
 * 开发端 vs 稳定端数据分离契约（文档化测试）。
 * 实际路径依赖 app.isPackaged，此处只验证命名与键名约定。
 */
describe('desktop data separation contract', () => {
  it('uses distinct app identity for dev and stable', () => {
    expect(DESKTOP_DEV_APP_NAME).not.toBe(DESKTOP_APP_NAME)
    expect(DESKTOP_DEV_APP_ID).not.toBe(DESKTOP_APP_ID)
    expect(DESKTOP_DEV_APP_NAME).toBe('白守 Dev')
    expect(DESKTOP_APP_NAME).toBe('白守')
  })

  it('stores device-local settings under userData filenames', () => {
    expect(DESKTOP_HOTKEY_CONFIG_FILE).toBe('device_hotkey_config.json')
    expect(DESKTOP_MCP_CONFIG_FILE).toBe('device_mcp_server_config.json')
  })

  it('tracks device-local agent db keys for purge and archive import', () => {
    expect(DESKTOP_DEVICE_LOCAL_AGENT_DB_KEYS).toEqual(['hotkey_config', 'mcp_server_config'])
  })

  it('uses different default MCP ports for dev vs stable', () => {
    expect(DESKTOP_DEV_DEFAULT_MCP_PORT).not.toBe(31004)
    expect(DESKTOP_DEV_DEFAULT_MCP_PORT).toBe(31005)
  })

  it('documents per-instance userData layout on Windows', () => {
    const appData = 'C:\\Users\\Me\\AppData\\Roaming'
    expect(join(appData, DESKTOP_DEV_APP_NAME)).toBe('C:\\Users\\Me\\AppData\\Roaming\\白守 Dev')
    expect(join(appData, DESKTOP_APP_NAME)).toBe('C:\\Users\\Me\\AppData\\Roaming\\白守')
  })
})
