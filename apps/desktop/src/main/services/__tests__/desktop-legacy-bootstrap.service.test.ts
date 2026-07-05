import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  isFilesystemRootPath,
  resolveLegacyMigrationTargetRoot,
  sanitizePersistedWorkspaceRoot
} from '@baishou/core/shared'
import {
  finishDesktopOnboarding,
  isDesktopOnboardingCompleted,
  resolveDesktopStorageBootstrap,
  validateFlutterLegacyMigrationTarget,
  writeDesktopOnboardingDirectory
} from '../desktop-legacy-bootstrap.service'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'appData') return '/tmp/baishou-app-data'
      if (name === 'userData') return '/tmp/baishou-user-data'
      return '/tmp/baishou-documents'
    })
  }
}))

vi.mock('@baishou/core-desktop', () => ({
  createNodeFileSystem: vi.fn(() => ({
    exists: vi.fn(async () => false),
    readFile: vi.fn(async () => ''),
    writeFile: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    readdir: vi.fn(async () => [])
  }))
}))

vi.mock('@baishou/database-desktop', () => ({
  connectionManager: { setDb: vi.fn() },
  installDatabaseSchema: vi.fn()
}))

vi.mock('../legacy-migration.service', () => ({
  LegacyMigrationService: vi.fn()
}))

vi.mock('../install-instance.service', () => ({
  getDesktopInstallInstanceId: vi.fn()
}))

vi.mock('../flutter-legacy-paths.service', () => ({
  resolveScoredLegacyRootCandidates: vi.fn(async () => []),
  buildLegacyRootCandidateInputs: vi.fn(async () => [])
}))

vi.mock('../../app-identity', () => ({
  isDesktopDevBuild: vi.fn(() => false)
}))

vi.mock('../../db', () => ({
  getAppDb: vi.fn(),
  resetAppDb: vi.fn()
}))

describe('desktop legacy workspace helpers', () => {
  it('re-exports shared workspace root helpers', () => {
    expect(resolveLegacyMigrationTargetRoot('D:\\')).toBe('D:\\BaiShou_Root')
    expect(sanitizePersistedWorkspaceRoot('D:\\')).toBe('D:\\BaiShou_Root')
    expect(isFilesystemRootPath('D:')).toBe(true)
  })
})

describe('desktop onboarding completion', () => {
  let settingsPath = ''

  beforeEach(async () => {
    settingsPath = join(
      tmpdir(),
      `baishou-onboarding-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      'baishou_settings.json'
    )
    await fs.mkdir(join(settingsPath, '..'), { recursive: true })
  })

  afterEach(async () => {
    if (settingsPath) {
      await fs.rm(join(settingsPath, '..'), { recursive: true, force: true }).catch(() => {})
    }
  })

  it('backfills onboarding_completed for legacy install without in_progress', async () => {
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ custom_storage_root: 'C:\\BaiShou_Root' }),
      'utf-8'
    )

    const bootstrap = await resolveDesktopStorageBootstrap(settingsPath)
    expect(bootstrap.needsOnboarding).toBe(false)
    expect(await isDesktopOnboardingCompleted(settingsPath)).toBe(true)
  })

  it('keeps needsOnboarding true when user picked directory but did not finish', async () => {
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        custom_storage_root: 'C:\\BaiShou_Root',
        onboarding_in_progress: true
      }),
      'utf-8'
    )

    const bootstrap = await resolveDesktopStorageBootstrap(settingsPath)
    expect(bootstrap.needsOnboarding).toBe(true)
    expect(await isDesktopOnboardingCompleted(settingsPath)).toBe(false)
  })

  it('writeDesktopOnboardingDirectory marks in_progress until finish', async () => {
    await writeDesktopOnboardingDirectory(settingsPath, 'C:\\picked\\baishou-data')
    const mid = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
    expect(mid.onboarding_in_progress).toBe(true)
    expect(mid.onboarding_completed).toBeUndefined()

    await finishDesktopOnboarding(settingsPath)
    const done = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
    expect(done.onboarding_completed).toBe(true)
    expect(done.onboarding_in_progress).toBeUndefined()
  })

  it('sanitizes and validates migration target paths', () => {
    expect(validateFlutterLegacyMigrationTarget('D:\\')).toBe('D:\\BaiShou_Root')
    expect(validateFlutterLegacyMigrationTarget('C:\\BaiShou_Root')).toBe('C:\\BaiShou_Root')
    expect(() => validateFlutterLegacyMigrationTarget('')).toThrow(
      'Invalid migration target directory'
    )
  })
})
