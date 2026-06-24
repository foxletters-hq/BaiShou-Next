import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  dedupeSqlitePaths,
  discoverVaultNames,
  hasFlutterLegacyStorageMarkers,
  isLegacyAppRoot,
  isMigrationCompleted,
  migrationStatusPath,
  normalizeSqliteAttachPath,
  readLegacyVaultRegistry,
  resolveAgentDbPath,
  resolveLegacyImportVaultNames,
  writeMigrationStatus,
  writeNextVaultRegistry
} from '../legacy-migration.shared'

describe('legacy-migration.shared', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-migration-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('detects legacy roots by global markers and vault journals', async () => {
    const legacyRoot = path.join(tempDir, 'legacy-a')
    await fs.mkdir(path.join(legacyRoot, '.baishou'), { recursive: true })
    await fs.writeFile(path.join(legacyRoot, '.baishou', 'vault_registry.json'), '[]')
    expect(await isLegacyAppRoot(fileSystem, legacyRoot)).toBe(true)
    expect(await hasFlutterLegacyStorageMarkers(fileSystem, legacyRoot)).toBe(true)

    const legacyRootB = path.join(tempDir, 'legacy-b')
    await fs.mkdir(path.join(legacyRootB, 'Personal', 'Journals'), { recursive: true })
    await fs.writeFile(path.join(legacyRootB, 'Personal', 'Journals', '2024-01-01.md'), '# hi')
    expect(await isLegacyAppRoot(fileSystem, legacyRootB)).toBe(true)
    expect(await hasFlutterLegacyStorageMarkers(fileSystem, legacyRootB)).toBe(false)

    const emptyJournals = path.join(tempDir, 'legacy-empty')
    await fs.mkdir(path.join(emptyJournals, 'Personal', 'Journals'), { recursive: true })
    expect(await isLegacyAppRoot(fileSystem, emptyJournals)).toBe(false)

    const nestedJournals = path.join(tempDir, 'legacy-nested')
    await fs.mkdir(path.join(nestedJournals, 'Personal', 'Journals', '2024', '06'), {
      recursive: true
    })
    await fs.writeFile(
      path.join(nestedJournals, 'Personal', 'Journals', '2024', '06', '2024-06-15.md'),
      '# nested'
    )
    expect(await isLegacyAppRoot(fileSystem, nestedJournals)).toBe(true)
  })

  it('writes next vault registry with remapped paths', async () => {
    const targetRoot = path.join(tempDir, 'target')
    const vaults = await writeNextVaultRegistry(
      fileSystem,
      targetRoot,
      ['Personal', 'Work'],
      [
        {
          name: 'Personal',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastAccessedAt: '2024-02-01T00:00:00.000Z'
        }
      ]
    )

    expect(vaults).toHaveLength(2)
    const expectedPersonalPath = path.join(targetRoot, 'Personal')
    expect(vaults[0]?.path?.replace(/\\/g, '/')).toBe(expectedPersonalPath.replace(/\\/g, '/'))

    const registryRaw = await fs.readFile(path.join(targetRoot, 'vault_registry.json'), 'utf8')
    const registry = JSON.parse(registryRaw)
    expect(registry[0].path.replace(/\\/g, '/')).toBe(expectedPersonalPath.replace(/\\/g, '/'))
  })

  it('discovers vault names from legacy registry and filesystem', async () => {
    const sourceRoot = path.join(tempDir, 'source')
    await fs.mkdir(path.join(sourceRoot, '.baishou'), { recursive: true })
    await fs.writeFile(
      path.join(sourceRoot, '.baishou', 'vault_registry.json'),
      JSON.stringify([{ name: 'Personal' }, { name: 'Work' }])
    )
    expect(await discoverVaultNames(fileSystem, sourceRoot)).toEqual(['Personal', 'Work'])

    const fallbackRoot = path.join(tempDir, 'fallback')
    await fs.mkdir(path.join(fallbackRoot, 'Personal', 'Journals'), { recursive: true })
    expect(await discoverVaultNames(fileSystem, fallbackRoot)).toEqual(['Personal'])
  })

  it('resolveLegacyImportVaultNames skips registry entries missing on disk', async () => {
    const sourceRoot = path.join(tempDir, 'import-source')
    await fs.mkdir(path.join(sourceRoot, '.baishou'), { recursive: true })
    await fs.writeFile(
      path.join(sourceRoot, '.baishou', 'vault_registry.json'),
      JSON.stringify([{ name: 'Personal' }, { name: 'MissingVault' }, { name: 'config' }])
    )
    await fs.mkdir(path.join(sourceRoot, 'Personal', 'Journals'), { recursive: true })
    await fs.writeFile(
      path.join(sourceRoot, 'Personal', 'Journals', '2024-01-01.md'),
      '# hello',
      'utf8'
    )
    await fs.mkdir(path.join(sourceRoot, 'config'), { recursive: true })

    expect(await resolveLegacyImportVaultNames(fileSystem, sourceRoot)).toEqual(['Personal'])
  })

  it('tracks migration completion status at workspace root', async () => {
    const workspaceRoot = path.join(tempDir, 'workspace')
    await fs.mkdir(workspaceRoot, { recursive: true })
    const installInstanceId = 'mobile-test-install-1'

    expect(await isMigrationCompleted(fileSystem, workspaceRoot)).toBe(false)

    await writeMigrationStatus(fileSystem, workspaceRoot, {
      version: 1,
      completedAt: new Date().toISOString(),
      source: 'flutter_mobile',
      migrationCompleted: true,
      installInstanceId,
      ragSkipped: true,
      ragReembedRequired: true,
      vaultsMigrated: ['Personal']
    })

    expect(migrationStatusPath(workspaceRoot)).toContain('.baishou_next_migration.json')
    expect(await isMigrationCompleted(fileSystem, workspaceRoot)).toBe(true)
    expect(await isMigrationCompleted(fileSystem, workspaceRoot, installInstanceId)).toBe(true)
    expect(await isMigrationCompleted(fileSystem, workspaceRoot, 'other-install')).toBe(false)
    expect(await readLegacyVaultRegistry(fileSystem, workspaceRoot)).toEqual([])
  })

  it('normalizes sqlite attach paths for file URIs and android storage', () => {
    expect(normalizeSqliteAttachPath('file:///storage/emulated/0/foo.db')).toBe(
      '/storage/emulated/0/foo.db'
    )
    expect(normalizeSqliteAttachPath('/emulated/0/foo.db')).toBe('/storage/emulated/0/foo.db')
    expect(normalizeSqliteAttachPath("/tmp/o'h.db")).toBe("/tmp/o''h.db")
  })

  it('dedupes sqlite paths after normalization', () => {
    const paths = [
      'file:///storage/emulated/0/a.db',
      '/storage/emulated/0/a.db',
      '/storage/emulated/0/b.db'
    ]
    expect(dedupeSqlitePaths(paths)).toEqual([
      '/storage/emulated/0/a.db',
      '/storage/emulated/0/b.db'
    ])
  })

  it('resolves agent db path under workspace root', () => {
    expect(resolveAgentDbPath('/tmp/BaiShou_Root')).toBe('/tmp/BaiShou_Root/baishou_agent.db')
  })

  it('stages legacy sqlite using native paths (no file:// prefix)', async () => {
    const { stageLegacySqliteForAttach } = await import('../legacy-migration.shared')
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-sqlite-stage-'))
    const legacyDb = path.join(root, '工作', '.baishou', 'baishou.sqlite')
    await fs.mkdir(path.dirname(legacyDb), { recursive: true })
    await fs.writeFile(legacyDb, 'sqlite-bytes')

    const staged = await stageLegacySqliteForAttach(
      fileSystem,
      legacyDb,
      path.join(root, 'staging')
    )

    expect(staged).not.toContain('file:')
    expect(await fileSystem.exists(staged)).toBe(true)
    await fs.rm(root, { recursive: true, force: true })
  })
})
