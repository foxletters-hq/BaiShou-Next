import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY } from '@baishou/shared'
import type { LegacySelectiveMigrationManifest } from '@baishou/shared'
import { isBetterSqlite3Available } from './better-sqlite3-available'
import {
  writeBsV3Fixture,
  writeLegacyAgentDb,
  writeSourceAvatar,
  writeSourceSharedPreferences
} from '../../../../../../packages/core/src/migration/legacy-migration.fixture'

const mockTargetRoot = path.join(os.tmpdir(), 'baishou-legacy-migration-target')
const mockDocuments = path.join(os.tmpdir(), 'baishou-legacy-migration-docs')

const {
  mockDiarySave,
  mockVaultExists,
  mockCreateVault,
  mockSettingsGet,
  mockSettingsSet,
  mockGetProfile,
  mockSaveProfile,
  mockImportAvatar,
  mockAssistantCreate,
  mockSessionCreate,
  mockInsertMessageWithParts,
  mockResync,
  mockReadMachineSp
} = vi.hoisted(() => ({
  mockDiarySave: vi.fn().mockResolvedValue({ id: 1 }),
  mockVaultExists: vi.fn().mockReturnValue(false),
  mockCreateVault: vi.fn().mockResolvedValue(undefined),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockGetProfile: vi.fn(),
  mockSaveProfile: vi.fn(),
  mockImportAvatar: vi.fn().mockResolvedValue('avatars/user_avatar.jpg'),
  mockAssistantCreate: vi.fn().mockResolvedValue(undefined),
  mockSessionCreate: vi.fn().mockResolvedValue(undefined),
  mockInsertMessageWithParts: vi.fn().mockResolvedValue(undefined),
  mockResync: vi.fn().mockResolvedValue(undefined),
  mockReadMachineSp: vi.fn().mockResolvedValue({
    user_personas: JSON.stringify({ 本机身份: { name: 'MachineUser' } })
  })
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'documents') return mockDocuments
      return mockDocuments
    })
  }
}))

vi.mock('../../db', () => ({
  getAppDb: vi.fn(() => ({}))
}))

vi.mock('@baishou/database-desktop', () => ({
  SettingsRepository: class {
    get = mockSettingsGet
    set = mockSettingsSet
  },
  UserProfileRepository: class {
    getProfile = mockGetProfile
    saveProfile = mockSaveProfile
  }
}))

vi.mock('../../ipc/vault.ipc', () => ({
  vaultService: {
    vaultExists: (...args: unknown[]) => mockVaultExists(...args),
    createVault: (...args: unknown[]) => mockCreateVault(...args)
  }
}))

vi.mock('../diary-vault.factory', () => ({
  getDiaryManagerForVault: vi.fn().mockResolvedValue({ save: mockDiarySave })
}))

vi.mock('../path.service', () => ({
  DesktopStoragePathService: class {
    getRootDirectory = vi.fn().mockImplementation(async () => mockTargetRoot)
  }
}))

vi.mock('../desktop-attachment-manager.service', () => ({
  DesktopAttachmentManagerService: class {
    importAvatar = mockImportAvatar
  }
}))

vi.mock('../../ipc/agent-helpers', () => ({
  getAgentManagers: vi.fn(() => ({
    assistantManager: { create: mockAssistantCreate },
    sessionManager: {
      create: mockSessionCreate,
      upsertSession: mockSessionCreate,
      insertMessageWithParts: mockInsertMessageWithParts
    },
    realSessionRepo: { togglePin: vi.fn().mockResolvedValue(undefined) }
  }))
}))

vi.mock('../flutter-legacy-paths.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../flutter-legacy-paths.service')>()
  return {
    ...actual,
    resolveLegacyRootCandidates: vi.fn().mockResolvedValue([]),
    readFlutterSharedPreferencesRaw: mockReadMachineSp
  }
})

vi.mock('../bootstrapper.service', () => ({
  globalBootstrapper: { fullyResyncAllEcosystems: mockResync }
}))

import { LegacySelectiveMigrationService } from '../legacy-selective-migration.service'

describe('LegacySelectiveMigrationService', () => {
  let service: LegacySelectiveMigrationService
  let sourceDir: string
  let tempDir: string
  let manifestStore: LegacySelectiveMigrationManifest | null = null

  beforeEach(async () => {
    service = new LegacySelectiveMigrationService()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-svc-'))
    sourceDir = path.join(tempDir, 'source')
    manifestStore = null

    mockSettingsGet.mockImplementation(async (key: string) =>
      key === LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY ? manifestStore : null
    )
    mockSettingsSet.mockImplementation(async (key: string, val: unknown) => {
      if (key === LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY) {
        manifestStore = val as LegacySelectiveMigrationManifest
      }
    })
    mockGetProfile.mockResolvedValue({
      personas: {},
      activePersonaId: 'default',
      avatarPath: null,
      nickname: ''
    })
    mockSaveProfile.mockResolvedValue(undefined)
    mockVaultExists.mockReturnValue(false)
    mockDiarySave.mockClear()
    mockImportAvatar.mockClear()
    mockAssistantCreate.mockClear()
    mockSessionCreate.mockClear()
    mockInsertMessageWithParts.mockClear()
    mockResync.mockClear()

    await fs.rm(mockTargetRoot, { recursive: true, force: true }).catch(() => null)
    await fs.mkdir(mockTargetRoot, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  describe('scan', () => {
    it('bs-v3 explicit dir shows file-only notes and no machine identity cards', async () => {
      await writeBsV3Fixture(sourceDir)
      const result = await service.scan(sourceDir)
      expect(result.notes?.some((n) => n.includes('纯文件工作区'))).toBe(true)
      const identity = result.sections.find((s) => s.id === 'identityCards')
      expect(identity?.detected).toBe(false)
      const config = result.sections.find((s) => s.id === 'config')
      expect(config?.detected).toBe(false)
    })

    it('counts two diary entries for same-day markdown files', async () => {
      await writeBsV3Fixture(sourceDir)
      const diaries = (await service.scan(sourceDir)).sections.find((s) => s.id === 'diaries')
      expect(diaries?.count).toBe(2)
      expect(diaries?.importable).toBe(true)
    })

    it('detects workspaces with Archives and empty vault from registry', async () => {
      await writeBsV3Fixture(sourceDir)
      const workspaces = (await service.scan(sourceDir)).sections.find((s) => s.id === 'workspaces')
      expect(workspaces?.count).toBe(2)
      expect(workspaces?.warnings?.some((w) => w.includes('Archives'))).toBe(true)
    })

    it('reads identity from source shared_preferences when present in explicit dir', async () => {
      await writeBsV3Fixture(sourceDir)
      await writeSourceSharedPreferences(sourceDir, {
        备份身份: { name: 'FromBackup' }
      })
      const identity = (await service.scan(sourceDir)).sections.find(
        (s) => s.id === 'identityCards'
      )
      expect(identity?.detected).toBe(true)
      expect(identity?.count).toBe(1)
    })
  })

  describe('importSelected', () => {
    it('imports both same-day markdown files via diary save', async () => {
      await writeBsV3Fixture(sourceDir)
      const result = await service.importSelected(sourceDir, { diaries: true })
      const diaries = result.sections.find((s) => s.id === 'diaries')
      expect(diaries?.success).toBe(2)
      expect(diaries?.failed).toBe(0)
      expect(mockDiarySave).toHaveBeenCalledTimes(2)
      const dates = mockDiarySave.mock.calls.map((c) => c[1]?.date)
      expect(dates[0]).toEqual(dates[1])
    })

    it('skips duplicate diary imports on second run via manifest', async () => {
      await writeBsV3Fixture(sourceDir)
      await service.importSelected(sourceDir, { diaries: true })
      mockDiarySave.mockClear()
      const second = await service.importSelected(sourceDir, { diaries: true })
      const diaries = second.sections.find((s) => s.id === 'diaries')
      expect(diaries?.skipped).toBe(2)
      expect(diaries?.success).toBe(0)
      expect(mockDiarySave).not.toHaveBeenCalled()
    })

    it('imports identity cards from source SP with random suffix', async () => {
      await writeBsV3Fixture(sourceDir)
      await writeSourceSharedPreferences(sourceDir, {
        备份身份: { name: 'FromBackup' }
      })
      const result = await service.importSelected(sourceDir, { identityCards: true })
      const section = result.sections.find((s) => s.id === 'identityCards')
      expect(section?.success).toBe(1)
      expect(mockSaveProfile).toHaveBeenCalled()
      const saved = mockSaveProfile.mock.calls[0]![0]
      const persona = Object.values(saved.personas)[0] as { id: string; facts: { name: string } }
      expect(persona.facts.name).toBe('FromBackup')
      expect(persona.id).toMatch(/^备份身份 \d{2}$/)
    })

    it('skips duplicate identity import on second run', async () => {
      await writeBsV3Fixture(sourceDir)
      await writeSourceSharedPreferences(sourceDir, {
        备份身份: { name: 'FromBackup' }
      })
      await service.importSelected(sourceDir, { identityCards: true })
      mockSaveProfile.mockClear()
      const second = await service.importSelected(sourceDir, { identityCards: true })
      const section = second.sections.find((s) => s.id === 'identityCards')
      expect(section?.skipped).toBe(1)
      expect(section?.success).toBe(0)
      expect(mockSaveProfile).not.toHaveBeenCalled()
    })

    it('overwrites avatar from source config only', async () => {
      await writeBsV3Fixture(sourceDir)
      await writeSourceAvatar(sourceDir, 'jpg')
      const result = await service.importSelected(sourceDir, { avatar: true })
      const avatar = result.sections.find((s) => s.id === 'avatar')
      expect(avatar?.success).toBe(1)
      expect(mockImportAvatar).toHaveBeenCalled()
      expect(mockSaveProfile).toHaveBeenCalled()
    })

    it('registers vaults and copies Archives without importing Journals', async () => {
      await writeBsV3Fixture(sourceDir)
      await fs.writeFile(path.join(sourceDir, 'Personal', 'Journals', 'extra.md'), '# x')
      const result = await service.importSelected(sourceDir, { workspaces: true })
      const workspaces = result.sections.find((s) => s.id === 'workspaces')
      expect(workspaces?.success).toBe(2)
      expect(mockCreateVault).toHaveBeenCalledWith('Personal')
      expect(mockCreateVault).toHaveBeenCalledWith('工作')
      const archiveDest = path.join(mockTargetRoot, 'Personal', 'Archives', 'note.md')
      await expect(fs.stat(archiveDest)).resolves.toBeDefined()
      const journalDest = path.join(mockTargetRoot, 'Personal', 'Journals', '2024-06-01.md')
      await expect(fs.stat(journalDest)).rejects.toThrow()
    })

    it('runs post-import resync when not cancelled', async () => {
      await writeBsV3Fixture(sourceDir)
      await service.importSelected(sourceDir, { diaries: true })
      expect(mockResync).toHaveBeenCalled()
    })

    it('persists manifest after import', async () => {
      await writeBsV3Fixture(sourceDir)
      await service.importSelected(sourceDir, { diaries: true })
      expect(manifestStore?.diaries).toBeDefined()
      expect(Object.keys(manifestStore?.diaries ?? {}).length).toBe(2)
    })
  })

  describe.skipIf(!isBetterSqlite3Available())('sqlite-backed import', () => {
    it('imports assistants with renamed suffix and manifest skip on re-run', async () => {
      await writeBsV3Fixture(sourceDir)
      const { assistantId } = await writeLegacyAgentDb(sourceDir, 'Personal')
      const first = await service.importSelected(sourceDir, { assistants: true })
      const assistants = first.sections.find((s) => s.id === 'assistants')
      expect(assistants?.success).toBe(1)
      expect(mockAssistantCreate).toHaveBeenCalledTimes(1)
      const created = mockAssistantCreate.mock.calls[0]![0]
      expect(created.name).toMatch(/^测试伙伴 \d{2}$/)
      expect(manifestStore?.assistants?.[assistantId]).toBeTruthy()

      mockAssistantCreate.mockClear()
      const second = await service.importSelected(sourceDir, { assistants: true })
      expect(second.sections.find((s) => s.id === 'assistants')?.skipped).toBe(1)
      expect(mockAssistantCreate).not.toHaveBeenCalled()
    })

    it('imports chat messages bound to remapped assistant', async () => {
      await writeBsV3Fixture(sourceDir)
      await writeLegacyAgentDb(sourceDir, 'Personal')
      const result = await service.importSelected(sourceDir, {
        assistants: true,
        chatMessages: true
      })
      const chat = result.sections.find((s) => s.id === 'chatMessages')
      expect(chat?.success).toBeGreaterThan(0)
      expect(mockSessionCreate).toHaveBeenCalled()
      expect(mockInsertMessageWithParts).toHaveBeenCalled()
      const sessionArg = mockSessionCreate.mock.calls[0]![0]
      expect(sessionArg.assistantId).toBeTruthy()
    })
  })
})
