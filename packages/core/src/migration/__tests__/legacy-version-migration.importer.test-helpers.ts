import { vi } from 'vitest'
import type { LegacyVersionMigrationImporterDeps } from '../legacy-version-migration.importer'

export function createDeps(
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
    vaultService: {
      getAllVaults: () => [],
      vaultExists: () => false,
      createVault: async () => {},
      switchVault: async () => {}
    } as never,
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
