import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  importLegacyConfigSection,
  importLegacyPersonasSection
} from '../legacy-version-migration.importer'
import { createDeps } from './legacy-version-migration.importer.test-helpers'

describe('legacy-version-migration.importer personas', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
  })

  it('appends two-digit suffix when persona id conflicts', async () => {
    const deps = createDeps()
    const result = await importLegacyPersonasSection(deps)
    expect(result.imported).toBe(1)
    const saveProfile = deps.profileRepo.saveProfile as ReturnType<typeof vi.fn>
    const saved = saveProfile.mock.calls[0]?.[0]
    const ids = Object.keys(saved.personas)
    expect(ids.some((id) => /^旅行者\d{2}$/.test(id))).toBe(true)
  })

  it('imports user_personas from config when raw SP has no personas', async () => {
    const deps = createDeps({
      flutterRawSp: { user_nickname: 'Nick' },
      flutterPrefsConfig: {
        user_personas: JSON.stringify({ 工作: { 职业: '工程师' } })
      },
      existingPersonaIds: async () => new Set()
    })

    const result = await importLegacyPersonasSection(deps)
    expect(result.imported).toBe(1)
    const saveProfile = deps.profileRepo.saveProfile as ReturnType<typeof vi.fn>
    const saved = saveProfile.mock.calls[0]?.[0]
    expect(saved.personas['工作']?.facts).toEqual({ 职业: '工程师' })
  })

  it('merges legacy facts into an existing same-name persona and restores active persona', async () => {
    const deps = createDeps({
      flutterRawSp: {
        user_active_persona_id: '默认身份',
        user_personas: JSON.stringify({
          默认身份: { 姓名: 'Anson', 职业: '全栈开发' }
        })
      },
      profileRepo: {
        getProfile: async () => ({
          nickname: 'test',
          avatarPath: null,
          activePersonaId: '默认身份',
          personas: { 默认身份: { id: '默认身份', facts: {} } }
        }),
        saveProfile: vi.fn(async () => {})
      } as never,
      existingPersonaIds: async () => new Set(['默认身份'])
    })

    const result = await importLegacyPersonasSection(deps)
    expect(result.imported).toBe(1)
    const saveProfile = deps.profileRepo.saveProfile as ReturnType<typeof vi.fn>
    const saved = saveProfile.mock.calls[0]?.[0]
    expect(saved.activePersonaId).toBe('默认身份')
    expect(saved.personas['默认身份']?.facts).toEqual({ 姓名: 'Anson', 职业: '全栈开发' })
  })

  it('flushes settings to disk after saving imported personas', async () => {
    const flushSettingsToDisk = vi.fn(async () => {})
    const deps = createDeps({
      flushSettingsToDisk,
      existingPersonaIds: async () => new Set()
    })

    await importLegacyPersonasSection(deps)

    expect(flushSettingsToDisk).toHaveBeenCalledTimes(1)
  })

  it('merges identity_facts into active persona instead of creating a new card', async () => {
    const deps = createDeps({
      flutterRawSp: { user_nickname: 'Nick' },
      flutterPrefsConfig: {
        identity_facts: { name: 'Anson', role: 'dev' }
      },
      existingPersonaIds: async () => new Set()
    })

    const result = await importLegacyPersonasSection(deps)
    expect(result.imported).toBe(1)
    const saveProfile = deps.profileRepo.saveProfile as ReturnType<typeof vi.fn>
    const saved = saveProfile.mock.calls[0]?.[0]
    expect(saved.personas.default.facts).toEqual({ name: 'Anson', role: 'dev' })
    expect(saved.personas['默认身份']).toBeUndefined()
  })
})

describe('legacy-version-migration.importer config', () => {
  it('preserves existing cloud_sync_config when importing legacy config', async () => {
    const set = vi.fn(async () => {})
    const get = vi.fn(async (key: string) => {
      if (key === 'cloud_sync_config') return { target: 's3', s3Bucket: 'keep-me' }
      return undefined
    })
    const restoreSpy = vi.spyOn(
      await import('../../import/legacy-config-restore.shared'),
      'restoreLegacyDevicePreferences'
    )
    restoreSpy.mockResolvedValue(undefined)

    const deps = createDeps({
      flutterPrefsConfig: { sync_target: 1, webdav_url: 'https://legacy.example' },
      settingsRepo: { get, set } as never
    })

    const result = await importLegacyConfigSection(deps)
    expect(result.imported).toBe(1)
    expect(restoreSpy).toHaveBeenCalledWith(
      deps.settingsRepo,
      deps.profileRepo,
      deps.flutterPrefsConfig,
      { preserveCloudSync: true, skipProfileFields: true }
    )
    expect(set).not.toHaveBeenCalledWith(
      'cloud_sync_config',
      expect.objectContaining({ webdavUrl: 'https://legacy.example' })
    )
    restoreSpy.mockRestore()
  })
})
