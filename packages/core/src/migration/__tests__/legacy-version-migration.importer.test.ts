import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  importLegacyConfigSection,
  importLegacyArchivesForVault,
  importLegacyDiariesForVault,
  importLegacyPersonasSection
} from '../legacy-version-migration.importer'
import type { LegacyVersionMigrationImporterDeps } from '../legacy-version-migration.importer'

function createDeps(
  overrides: Partial<LegacyVersionMigrationImporterDeps> = {}
): LegacyVersionMigrationImporterDeps {
  return {
    fileSystem: {} as never,
    sourceRoot: '/legacy',
    targetRoot: '/target',
    flutterPrefsConfig: null,
    flutterRawSp: {
      user_personas: JSON.stringify({
        旅行者: { 城市: '上海' }
      })
    },
    flutterDocumentsAvatarsDir: null,
    sqliteClient: {},
    executeRawSql: async () => ({ rows: [] }),
    settingsRepo: {} as never,
    profileRepo: {
      getProfile: async () => ({
        nickname: 'test',
        avatarPath: null,
        activePersonaId: 'default',
        personas: { default: { id: 'default', facts: {} } }
      }),
      saveProfile: vi.fn(async () => {})
    } as never,
    diaryService: {} as never,
    assistantManager: {} as never,
    sessionManager: {} as never,
    vaultService: { getAllVaults: () => [], vaultExists: () => false, createVault: async () => {}, switchVault: async () => {} } as never,
    importAvatar: async () => 'avatars/x.png',
    saveUserAvatarPath: async () => {},
    existingAssistantNames: async () => new Set(),
    existingSessionIds: async () => new Set(),
    existingPersonaIds: async () => new Set(['旅行者']),
    upsertSessionAggregate: async () => {},
    runInVaultContext: async (_vaultName, fn) => fn(),
    resolveTargetVaultName: async (name) => name,
    ...overrides
  }
}

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
      { preserveCloudSync: true }
    )
    expect(set).not.toHaveBeenCalledWith(
      'cloud_sync_config',
      expect.objectContaining({ webdavUrl: 'https://legacy.example' })
    )
    restoreSpy.mockRestore()
  })
})

describe('legacy-version-migration.importer diaries', () => {
  it('imports a single legacy vault inside runInVaultContext', async () => {
    const vaultContexts: string[] = []
    const writeFile = vi.fn(async () => undefined)
    const mkdir = vi.fn(async () => undefined)
    const deps = createDeps({
      fileSystem: {
        exists: async (filePath: string) => {
          if (String(filePath).includes('/target/')) return false
          return true
        },
        readdir: async (dir: string) => {
          if (dir.endsWith('Journals')) return ['2024-01-15.md']
          return []
        },
        readFile: async () => '---\ndate: 2024-01-15\n---\n\nbody',
        writeFile,
        mkdir,
        stat: async () => ({ isDirectory: false })
      } as never,
      getJournalsBaseDirectory: async () => '/target/Personal/Journals',
      runInVaultContext: async (vaultName, fn) => {
        vaultContexts.push(vaultName)
        return fn()
      }
    })

    const result = await importLegacyDiariesForVault(
      {
        ...deps,
        sourceRoot: '/legacy'
      },
      'Personal'
    )

    expect(vaultContexts).toEqual(['Personal'])
    expect(writeFile).toHaveBeenCalled()
    expect(result.imported).toBe(1)
  })

  it('skips diary when target file already matches legacy content', async () => {
    const raw = '---\ndate: 2024-01-15\n---\n\nbody'
    const writeFile = vi.fn(async () => undefined)
    const deps = createDeps({
      fileSystem: {
        exists: async () => true,
        readdir: async (dir: string) => {
          if (dir.endsWith('Journals')) return ['2024-01-15.md']
          return []
        },
        readFile: async (filePath: string) => {
          if (String(filePath).includes('/legacy/')) return raw
          return raw
        },
        writeFile,
        stat: async () => ({ isDirectory: false })
      } as never,
      getJournalsBaseDirectory: async () => '/target/Personal/Journals',
      readTargetJournalRaw: async () => raw,
      runInVaultContext: async (_vaultName, fn) => fn()
    })

    const result = await importLegacyDiariesForVault(
      { ...deps, sourceRoot: '/legacy' },
      'Personal'
    )

    expect(result.skipped).toBe(1)
    expect(result.imported).toBe(0)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('writes diaries into the mapped target vault when the original name conflicts', async () => {
    const writeFile = vi.fn(async () => undefined)
    const deps = createDeps({
      fileSystem: {
        exists: async (filePath: string) => {
          if (String(filePath).includes('/target/')) return false
          return true
        },
        readdir: async (dir: string) => {
          if (dir.endsWith('Journals')) return ['2024-01-15.md']
          return []
        },
        readFile: async () => '---\ndate: 2024-01-15\n---\n\nbody',
        writeFile,
        mkdir: vi.fn(async () => undefined),
        stat: async () => ({ isDirectory: false })
      } as never,
      resolveTargetVaultName: async () => 'Personal95',
      getJournalsBaseDirectory: async (targetVaultName) => `/target/${targetVaultName}/Journals`,
      readTargetJournalRaw: async (_dateStr, targetVaultName) => {
        expect(targetVaultName).toBe('Personal95')
        return null
      },
      runInVaultContext: async (_vaultName, fn) => fn()
    })

    const result = await importLegacyDiariesForVault(
      { ...deps, sourceRoot: '/legacy' },
      'Personal'
    )

    expect(result.imported).toBe(1)
    expect(writeFile).toHaveBeenCalledWith(
      '/target/Personal95/Journals/2024/01/2024-01-15.md',
      expect.any(String),
      'utf8'
    )
  })
})

describe('legacy-version-migration.importer archives', () => {
  it('copies legacy Archives tree into target vault', async () => {
    const copyFile = vi.fn(async () => undefined)
    const mkdir = vi.fn(async () => undefined)
    const deps = createDeps({
      fileSystem: {
        exists: async (p: string) => String(p).includes('Archives'),
        readdir: async (dir: string) => {
          if (dir.endsWith('Archives')) return ['Weekly']
          if (dir.endsWith('Weekly')) return ['2024-01-01.md']
          return []
        },
        stat: async (p: string) => ({
          isDirectory: String(p).endsWith('Archives') || String(p).endsWith('Weekly')
        }),
        copyFile,
        mkdir
      } as never,
      targetRoot: '/target',
      resolveTargetVaultName: async () => 'Personal'
    })

    const result = await importLegacyArchivesForVault(
      { ...deps, sourceRoot: '/legacy' },
      'Personal'
    )

    expect(copyFile).toHaveBeenCalled()
    expect(result.imported).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('returns empty result when legacy Archives is missing', async () => {
    const deps = createDeps({
      fileSystem: {
        exists: async () => false
      } as never
    })

    const result = await importLegacyArchivesForVault(
      { ...deps, sourceRoot: '/legacy' },
      'Personal'
    )

    expect(result).toEqual({ imported: 0, skipped: 0, failed: 0 })
  })
})
