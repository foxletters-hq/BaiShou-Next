import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  appendTwoRandomDigits,
  buildLegacyDiaryImportItems,
  collectLegacyDiaryMarkdownEntries,
  countImportableDiaryEntries,
  countJournalMarkdownFiles,
  countUniqueDiaryEntries,
  diaryManifestKey,
  extractJournalDateKey,
  formatMigrationSizeBytes,
  hashDiaryContent,
  hashIdentityFacts,
  isValidDateKey,
  mapBaishouDbToVaultName,
  parseFlutterPersonasFromSp,
  personaManifestKey,
  resolveJournalMarkdownDateKey,
  resolveLegacyAvatarCandidates,
  resolveLegacyIdentityPersonas,
  sumDirectorySizeBytes
} from '../legacy-selective-migration.shared'
import { mergeDirectories, mergeDirectoriesSkipExisting } from '../legacy-migration.shared'

describe('legacy-selective-migration.shared', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-selective-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('appendTwoRandomDigits adds a space and two digits', () => {
    const result = appendTwoRandomDigits('默认身份')
    expect(result).toMatch(/^默认身份 \d{2}$/)
    const suffix = result.split(' ').pop()
    const num = Number(suffix)
    expect(num).toBeGreaterThanOrEqual(10)
    expect(num).toBeLessThanOrEqual(99)
  })

  it('parseFlutterPersonasFromSp reads user_personas map', () => {
    const sp = {
      user_personas: JSON.stringify({
        默认身份: { name: 'Anson', role: '开发者' },
        工作: { name: 'Worker' }
      })
    }
    const personas = parseFlutterPersonasFromSp(sp)
    expect(personas).toHaveLength(2)
    expect(personas[0]?.id).toBe('默认身份')
    expect(personas[0]?.facts.name).toBe('Anson')
  })

  it('extractJournalDateKey parses nested filenames', () => {
    expect(extractJournalDateKey('2024-06-15', 'ignored')).toBe('2024-06-15')
    expect(extractJournalDateKey('note', '2024-06-15')).toBe('2024-06-15')
    expect(extractJournalDateKey('bad', 'readme')).toBeNull()
  })

  it('mapBaishouDbToVaultName resolves vault from sqlite path', () => {
    const dbPath = 'D:/BaiShou_Root/Personal/.baishou/baishou.sqlite'
    expect(mapBaishouDbToVaultName(dbPath, ['Personal', 'Work'])).toBe('Personal')
  })

  it('formatMigrationSizeBytes formats megabytes', () => {
    expect(formatMigrationSizeBytes(0)).toBe('0 MB')
    expect(formatMigrationSizeBytes(1024 * 1024)).toBe('1.00 MB')
  })

  it('countJournalMarkdownFiles walks nested journal dirs', async () => {
    const journalsDir = path.join(tempDir, 'Journals', '2024', '06')
    await fs.mkdir(journalsDir, { recursive: true })
    await fs.writeFile(path.join(journalsDir, '2024-06-01.md'), '# diary')
    await fs.writeFile(path.join(journalsDir, '2024-06-02.md'), '# diary2')

    const stats = await countJournalMarkdownFiles(fileSystem, path.join(tempDir, 'Journals'))
    expect(stats.count).toBe(2)
    expect(stats.sizeBytes).toBeGreaterThan(0)
    expect(stats.samples).toContain('2024-06-01')
  })

  it('sumDirectorySizeBytes skips configured directories', async () => {
    const root = path.join(tempDir, 'vault')
    await fs.mkdir(path.join(root, '.baishou'), { recursive: true })
    await fs.mkdir(path.join(root, 'Journals'), { recursive: true })
    await fs.writeFile(path.join(root, 'Journals', 'a.md'), 'hello world')
    await fs.writeFile(path.join(root, '.baishou', 'agent.sqlite'), 'x'.repeat(100))

    const size = await sumDirectorySizeBytes(fileSystem, root, {
      skipDirNames: new Set(['.baishou'])
    })
    expect(size).toBeGreaterThanOrEqual(11)
    expect(size).toBeLessThan(100)
  })

  it('mergeDirectoriesSkipExisting does not overwrite existing files', async () => {
    const src = path.join(tempDir, 'src')
    const dest = path.join(tempDir, 'dest')
    await fs.mkdir(src, { recursive: true })
    await fs.mkdir(dest, { recursive: true })
    await fs.writeFile(path.join(src, 'a.txt'), 'from-source')
    await fs.writeFile(path.join(dest, 'a.txt'), 'keep-dest')

    const failed = await mergeDirectoriesSkipExisting(fileSystem, src, dest)
    expect(failed).toEqual([])
    expect(await fs.readFile(path.join(dest, 'a.txt'), 'utf8')).toBe('keep-dest')
  })

  it('mergeDirectories treats identical src and dest as no-op', async () => {
    const vaultDir = path.join(tempDir, 'vault')
    await fs.mkdir(path.join(vaultDir, '.baishou'), { recursive: true })
    await fs.writeFile(path.join(vaultDir, '.baishou', 'agent.sqlite'), 'legacy-db')

    const failed = await mergeDirectories(fileSystem, vaultDir, vaultDir)
    expect(failed).toEqual([])
    expect(await fs.readFile(path.join(vaultDir, '.baishou', 'agent.sqlite'), 'utf8')).toBe(
      'legacy-db'
    )
  })

  it('isValidDateKey rejects invalid calendar dates', () => {
    expect(isValidDateKey('2024-06-15')).toBe(true)
    expect(isValidDateKey('2024-13-01')).toBe(false)
    expect(isValidDateKey('bad')).toBe(false)
  })

  it('countUniqueDiaryEntries prefers markdown over sqlite for same day', () => {
    const md = new Map([['Personal', new Set(['2024-06-01', '2024-06-02'])]])
    const sq = new Map([['Personal', new Set(['2024-06-01', '2024-06-03'])]])
    expect(countUniqueDiaryEntries(md, sq)).toBe(3)
  })

  it('hashDiaryContent and diaryManifestKey are stable', () => {
    const hash = hashDiaryContent('hello diary')
    expect(hash).toHaveLength(16)
    expect(diaryManifestKey('Personal', '2024-06-01', hash)).toBe(
      `Personal/2024-06-01:${hash}`
    )
  })

  it('resolveLegacyIdentityPersonas falls back to identity_facts', () => {
    const personas = resolveLegacyIdentityPersonas(null, {
      identity_facts: { name: 'Anson', role: 'dev' }
    })
    expect(personas).toHaveLength(1)
    expect(personas[0]?.facts.name).toBe('Anson')
  })

  it('personaManifestKey combines source id and facts hash', () => {
    const key = personaManifestKey('默认身份', { name: 'Anson' })
    expect(key).toContain('默认身份:')
    expect(key).toBe(`默认身份:${hashIdentityFacts({ name: 'Anson' })}`)
  })

  it('countImportableDiaryEntries counts each markdown file separately', () => {
    const markdownCountByVault = new Map([['Personal', 2]])
    const markdownDatesByVault = new Map([['Personal', new Set(['2024-06-01'])]])
    const sqliteByVault = new Map([['Personal', new Set(['2024-06-01', '2024-06-03'])]])
    expect(
      countImportableDiaryEntries(markdownCountByVault, markdownDatesByVault, sqliteByVault)
    ).toBe(3)
  })

  it('resolveJournalMarkdownDateKey reads frontmatter date', () => {
    const raw = `---\ndate: 2024-06-18\n---\n# note\nbody`
    expect(resolveJournalMarkdownDateKey(raw, 'note')).toBe('2024-06-18')
  })

  it('buildLegacyDiaryImportItems keeps multiple markdown on same day and skips sqlite dup', () => {
    const hashA = hashDiaryContent('morning')
    const hashB = hashDiaryContent('evening')
    const items = buildLegacyDiaryImportItems(
      [
        {
          path: '/a.md',
          vaultName: 'Personal',
          dateKey: '2024-06-01',
          content: 'morning',
          contentHash: hashA
        },
        {
          path: '/b.md',
          vaultName: 'Personal',
          dateKey: '2024-06-01',
          content: 'evening',
          contentHash: hashB
        }
      ],
      [
        {
          vaultName: 'Personal',
          dateKey: '2024-06-01',
          content: 'sqlite duplicate',
          contentHash: hashDiaryContent('sqlite duplicate')
        },
        {
          vaultName: 'Personal',
          dateKey: '2024-06-02',
          content: 'sqlite only',
          contentHash: hashDiaryContent('sqlite only')
        }
      ]
    )
    expect(items).toHaveLength(3)
    expect(items.filter((i) => i.source === 'markdown')).toHaveLength(2)
    expect(items.filter((i) => i.source === 'sqlite')).toHaveLength(1)
    expect(items.find((i) => i.source === 'sqlite')?.dateKey).toBe('2024-06-02')
  })

  it('diary manifest keys allow idempotent re-import skip', () => {
    const manifest: Record<string, true> = {}
    const item = {
      vaultName: 'Personal',
      dateKey: '2024-06-01',
      content: 'hello',
      contentHash: hashDiaryContent('hello')
    }
    const key = diaryManifestKey(item.vaultName, item.dateKey, item.contentHash)
    expect(manifest[key]).toBeUndefined()
    manifest[key] = true
    expect(manifest[key]).toBe(true)
  })

  it('resolveLegacyAvatarCandidates scopes to source dir when machine paths disabled', () => {
    const candidates = resolveLegacyAvatarCandidates(
      { user_avatar_path: 'C:/machine/avatar.jpg' },
      '/backup/bs-v3',
      { includeMachinePaths: false }
    )
    expect(candidates).toContain('C:/machine/avatar.jpg')
    expect(candidates.some((p) => p.includes('Documents'))).toBe(false)
    expect(candidates.some((p) => p.replace(/\\/g, '/').endsWith('bs-v3/config/avatar.jpg'))).toBe(
      true
    )
  })

  it('collectLegacyDiaryMarkdownEntries parses frontmatter-only filenames', async () => {
    const journalsDir = path.join(tempDir, 'Journals')
    await fs.mkdir(journalsDir, { recursive: true })
    await fs.writeFile(
      path.join(journalsDir, 'note.md'),
      '---\ndate: 2024-06-18\n---\n# Evening\ncontent'
    )

    const entries = await collectLegacyDiaryMarkdownEntries(fileSystem, journalsDir, 'Personal')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.dateKey).toBe('2024-06-18')
  })

  it('bs-v3 style file-only layout counts importable diaries', async () => {
    const root = path.join(tempDir, 'bs-v3')
    await fs.mkdir(path.join(root, 'Personal', 'Journals', '2024'), { recursive: true })
    await fs.mkdir(path.join(root, 'Personal', 'Archives'), { recursive: true })
    await fs.mkdir(path.join(root, '工作'), { recursive: true })
    await fs.mkdir(path.join(root, '.baishou'), { recursive: true })
    await fs.writeFile(path.join(root, 'Personal', 'Journals', '2024', '2024-06-01.md'), '# d1')
    await fs.writeFile(path.join(root, 'Personal', 'Archives', 'note.md'), '# archive')
    await fs.writeFile(
      path.join(root, '.baishou', 'vault_registry.json'),
      JSON.stringify([{ name: 'Personal' }, { name: '工作' }])
    )

    const entries = await collectLegacyDiaryMarkdownEntries(
      fileSystem,
      path.join(root, 'Personal', 'Journals'),
      'Personal'
    )
    expect(entries).toHaveLength(1)

    const markdownCountByVault = new Map([['Personal', entries.length]])
    const markdownDatesByVault = new Map([['Personal', new Set(entries.map((e) => e.dateKey))]])
    const sq = new Map<string, Set<string>>()
    expect(countImportableDiaryEntries(markdownCountByVault, markdownDatesByVault, sq)).toBe(1)
  })
})
