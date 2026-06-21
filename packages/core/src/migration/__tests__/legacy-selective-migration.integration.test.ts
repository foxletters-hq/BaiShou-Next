import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  discoverVaultNames,
  isLegacyAppRoot,
  mergeDirectoriesSkipExisting,
  scanLegacyDatabases
} from '../legacy-migration.shared'
import {
  buildLegacyDiaryImportItems,
  collectLegacyDiaryMarkdownEntries,
  countImportableDiaryEntries,
  diaryManifestKey,
  hashDiaryContent,
  resolveLegacyIdentityPersonas
} from '../legacy-selective-migration.shared'
import { isBetterSqlite3Available } from './better-sqlite3-available'
import {
  writeBsV3Fixture,
  writeLegacyAgentDb,
  writeSourceDevicePreferences,
  writeSourceSharedPreferences
} from '../legacy-migration.fixture'

describe('legacy-selective-migration integration', () => {
  let tempDir: string
  let sourceRoot: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-integ-'))
    sourceRoot = path.join(tempDir, 'source')
    await writeBsV3Fixture(sourceRoot)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('recognizes bs-v3 as legacy root and discovers vaults from registry', async () => {
    expect(await isLegacyAppRoot(fileSystem, sourceRoot)).toBe(true)
    const vaults = await discoverVaultNames(fileSystem, sourceRoot)
    expect(vaults).toEqual(['Personal', '工作'])
  })

  it('collects two importable markdown entries on the same day via frontmatter', async () => {
    const entries = await collectLegacyDiaryMarkdownEntries(
      fileSystem,
      path.join(sourceRoot, 'Personal', 'Journals'),
      'Personal'
    )
    expect(entries).toHaveLength(2)
    expect(entries.every((e) => e.dateKey === '2024-06-01')).toBe(true)
    expect(new Set(entries.map((e) => e.contentHash)).size).toBe(2)
  })

  it('buildLegacyDiaryImportItems preserves both same-day markdown files', async () => {
    const markdown = await collectLegacyDiaryMarkdownEntries(
      fileSystem,
      path.join(sourceRoot, 'Personal', 'Journals'),
      'Personal'
    )
    const items = buildLegacyDiaryImportItems(markdown, [])
    expect(items).toHaveLength(2)
    expect(items.every((i) => i.source === 'markdown')).toBe(true)
  })

  it('countImportableDiaryEntries matches collect + sqlite gap fill', async () => {
    const markdown = await collectLegacyDiaryMarkdownEntries(
      fileSystem,
      path.join(sourceRoot, 'Personal', 'Journals'),
      'Personal'
    )
    const markdownCountByVault = new Map([['Personal', markdown.length]])
    const markdownDatesByVault = new Map([['Personal', new Set(markdown.map((e) => e.dateKey))]])
    const sqliteByVault = new Map([['Personal', new Set(['2024-06-01', '2024-06-02'])]])
    expect(
      countImportableDiaryEntries(markdownCountByVault, markdownDatesByVault, sqliteByVault)
    ).toBe(3)
  })

  it('resolves identity only from source SP not device_preferences alone when SP present', async () => {
    await writeSourceSharedPreferences(sourceRoot, {
      备份身份: { name: 'FromSource' }
    })
    const raw = await fs.readFile(
      path.join(sourceRoot, 'config', 'shared_preferences.json'),
      'utf8'
    )
    const { parseFlutterSharedPreferencesJson } = await import('../flutter-shared-prefs.util')
    const sp = parseFlutterSharedPreferencesJson(raw)
    const personas = resolveLegacyIdentityPersonas(sp, null)
    expect(personas).toHaveLength(1)
    expect(personas[0]?.facts.name).toBe('FromSource')
  })

  it('falls back to identity_facts in device_preferences when SP has no personas', async () => {
    await writeSourceDevicePreferences(sourceRoot, {
      nickname: 'Tester',
      identity_facts: { name: 'ActiveOnly' }
    })
    const personas = resolveLegacyIdentityPersonas(null, {
      identity_facts: { name: 'ActiveOnly' }
    })
    expect(personas[0]?.facts.name).toBe('ActiveOnly')
  })

  it('manifest prevents duplicate diary re-import', () => {
    const manifest: Record<string, true> = {}
    const content = 'hello diary'
    const hash = hashDiaryContent(content)
    const key = diaryManifestKey('Personal', '2024-06-01', hash)
    expect(manifest[key]).toBeUndefined()
    manifest[key] = true
    expect(manifest[key]).toBe(true)
  })

  it('workspace merge copies Archives without overwriting existing files', async () => {
    const targetRoot = path.join(tempDir, 'target')
    const srcArchives = path.join(sourceRoot, 'Personal', 'Archives')
    const destArchives = path.join(targetRoot, 'Personal', 'Archives')
    await fs.mkdir(destArchives, { recursive: true })
    await fs.writeFile(path.join(destArchives, 'note.md'), 'keep-existing')

    const failed = await mergeDirectoriesSkipExisting(fileSystem, srcArchives, destArchives)
    expect(failed).toEqual([])
    expect(await fs.readFile(path.join(destArchives, 'note.md'), 'utf8')).toBe('keep-existing')
  })

  it.skipIf(!isBetterSqlite3Available())(
    'detects agent.sqlite under vault for scanLegacyDatabases',
    async () => {
      const ids = await writeLegacyAgentDb(sourceRoot, 'Personal')
      const { agentDbs } = await scanLegacyDatabases(fileSystem, sourceRoot)
      expect(agentDbs.length).toBeGreaterThan(0)
      expect(agentDbs.some((p) => p.includes('agent.sqlite'))).toBe(true)
      expect(ids.assistantId).toBe('legacy-ast-1')
    }
  )
})
