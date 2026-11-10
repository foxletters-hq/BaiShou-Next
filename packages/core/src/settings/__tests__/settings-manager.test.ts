import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsManagerService } from '../settings-manager.service'
import { SettingsRepository } from '@baishou/database'
import { SettingsFileService } from '../settings-file.service'
import {
  DEFAULT_USER_PROFILE,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY,
  getUserProfileFromSettings,
  saveUserProfileToSettings
} from '@baishou/shared'

describe('SettingsManagerService (Global Vault KV SSOT)', () => {
  let mockFileService: import('vitest').Mocked<SettingsFileService>
  let mockRepo: import('vitest').Mocked<SettingsRepository>
  let manager: SettingsManagerService

  beforeEach(() => {
    mockFileService = {
      writeAllSettings: vi.fn(),
      readAllSettings: vi.fn(),
      readAllSettingsForResync: vi.fn()
    } as any

    mockRepo = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
      getAllEntriesMeta: vi.fn().mockResolvedValue({})
    } as any

    manager = new SettingsManagerService(mockRepo, mockFileService)
  })

  it('get() delegates read to high-speed SQLite', async () => {
    mockRepo.get.mockResolvedValue('value-a' as any)
    const val = await manager.get('key-a')
    expect(mockRepo.get).toHaveBeenCalledWith('key-a')
    expect(val).toBe('value-a')
  })

  it('set() intercepts write, updates SQLite and flushes full snapshot to JSON', async () => {
    const fullMap = { 'key-1': 'val-1', 'key-a': 'val-a' }
    mockRepo.getAll.mockResolvedValue(fullMap)

    await manager.set('key-a', 'val-a')

    expect(mockRepo.set).toHaveBeenCalledWith('key-a', 'val-a')
    expect(mockFileService.writeAllSettings).toHaveBeenCalledWith(fullMap)
  })

  it('fullResyncFromDisk() re-populates SQLite with disk map entries', async () => {
    const importedMap = { 'key-x': 'val-x', 'key-y': 'val-y' }
    mockFileService.readAllSettingsForResync.mockResolvedValue({
      settings: importedMap,
      domainFileMtimeMs: {}
    })

    await manager.fullResyncFromDisk()

    expect(mockRepo.set).toHaveBeenCalledWith('key-x', 'val-x')
    expect(mockRepo.set).toHaveBeenCalledWith('key-y', 'val-y')
  })

  it('fullResyncFromDisk() skips stale disk when sqlite is newer and flushes sqlite to disk', async () => {
    const sqliteUpdatedAt = new Date('2026-06-16T12:00:00.000Z')
    mockFileService.readAllSettingsForResync.mockResolvedValue({
      settings: { ai_providers: [{ id: 'openai', apiKey: '' }] },
      domainFileMtimeMs: { 'ai_providers.json': sqliteUpdatedAt.getTime() - 5000 }
    })
    mockRepo.getAllEntriesMeta.mockResolvedValue({
      ai_providers: {
        value: [{ id: 'openai', apiKey: 'sk-live' }],
        updatedAt: sqliteUpdatedAt
      }
    })
    mockRepo.getAll.mockResolvedValue({
      ai_providers: [{ id: 'openai', apiKey: 'sk-live' }]
    })

    await manager.fullResyncFromDisk()

    expect(mockRepo.set).not.toHaveBeenCalledWith('ai_providers', expect.anything())
    expect(mockFileService.writeAllSettings).toHaveBeenCalledWith({
      ai_providers: [{ id: 'openai', apiKey: 'sk-live' }]
    })
  })

  it('fullResyncFromDisk({ diskAuthoritative }) applies stale disk and does not flush', async () => {
    const sqliteUpdatedAt = new Date('2026-06-16T12:00:00.000Z')
    mockFileService.readAllSettingsForResync.mockResolvedValue({
      settings: { ai_providers: [{ id: 'openai', apiKey: 'from-disk' }] },
      domainFileMtimeMs: { 'ai_providers.json': sqliteUpdatedAt.getTime() - 5000 }
    })
    mockRepo.getAllEntriesMeta.mockResolvedValue({
      ai_providers: {
        value: [{ id: 'openai', apiKey: 'sk-live' }],
        updatedAt: sqliteUpdatedAt
      }
    })

    await manager.fullResyncFromDisk({ diskAuthoritative: true })

    expect(mockRepo.set).toHaveBeenCalledWith('ai_providers', [
      { id: 'openai', apiKey: 'from-disk' }
    ])
    expect(mockFileService.writeAllSettings).not.toHaveBeenCalled()
  })

  it('fullResyncFromDisk() skips device-local settings keys', async () => {
    mockFileService.readAllSettingsForResync.mockResolvedValue({
      settings: {
        'key-x': 'val-x',
        hotkey_config: { hotkeyEnabled: true, hotkeyModifier: 'Alt', hotkeyKey: 'S' },
        mcp_server_config: { mcpEnabled: true, mcpPort: 31004 }
      },
      domainFileMtimeMs: {}
    })

    await manager.fullResyncFromDisk()

    expect(mockRepo.set).toHaveBeenCalledWith('key-x', 'val-x')
    expect(mockRepo.set).not.toHaveBeenCalledWith('hotkey_config', expect.anything())
    expect(mockRepo.set).not.toHaveBeenCalledWith('mcp_server_config', expect.anything())
  })

  it('scopes GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY and user profile by active vault', async () => {
    const kv = new Map<string, unknown>([[USER_PROFILE_SETTINGS_KEY, { ...DEFAULT_USER_PROFILE }]])
    mockRepo.get.mockImplementation(async (key: string) => (kv.get(key) as any) ?? null)
    mockRepo.set.mockImplementation(async (key: string, value: unknown) => {
      kv.set(key, value)
    })
    mockRepo.getAll.mockImplementation(async () => Object.fromEntries(kv.entries()))

    let activeVaultId = 'vlt_1'
    const vaultManager = new SettingsManagerService(mockRepo, mockFileService, () => activeVaultId)

    expect(await vaultManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)).toBe(false)

    await saveUserProfileToSettings(vaultManager, {
      ...DEFAULT_USER_PROFILE,
      nickname: '窝一昵称',
      birthday: '1997-07-07',
      gender: 'female'
    })
    await vaultManager.set(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY, true)

    expect(await vaultManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)).toBe(true)
    const p1 = await getUserProfileFromSettings(vaultManager)
    expect(p1.nickname).toBe('窝一昵称')

    // 切换到小窝 2，尚未唤醒
    activeVaultId = 'vlt_2'
    expect(await vaultManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)).toBe(false)
    const p2 = await getUserProfileFromSettings(vaultManager)
    expect(p2.nickname).toBe('用户')
    expect(p2.birthday).toBeNull()
  })
})
