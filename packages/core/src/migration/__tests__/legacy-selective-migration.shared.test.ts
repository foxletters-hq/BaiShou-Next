import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  appendTwoRandomDigits,
  countJournalMarkdownFiles,
  extractJournalDateKey,
  formatMigrationSizeBytes,
  mapBaishouDbToVaultName,
  parseFlutterPersonasFromSp,
  sumDirectorySizeBytes
} from '../legacy-selective-migration.shared'
import { mergeDirectoriesSkipExisting } from '../legacy-migration.shared'

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
})
