import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  collectJournalPathsByDateInTree,
  isJournalPathUnderSkippedDir,
  journalMarkdownExistsInTree,
  resolveShadowJournalAbsolutePath
} from '../journal-files.util'

describe('journal-files.util', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'journal-files-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('detects nested yyyy/MM/yyyy-MM-dd.md layout', async () => {
    const journalsDir = path.join(tempDir, 'Journals', '2024', '06')
    await fs.mkdir(journalsDir, { recursive: true })
    await fs.writeFile(path.join(journalsDir, '2024-06-15.md'), '# hi')

    expect(await journalMarkdownExistsInTree(fileSystem, path.join(tempDir, 'Journals'))).toBe(true)
  })

  it('returns false for empty Journals directory', async () => {
    await fs.mkdir(path.join(tempDir, 'Journals'), { recursive: true })
    expect(await journalMarkdownExistsInTree(fileSystem, path.join(tempDir, 'Journals'))).toBe(
      false
    )
  })

  it('collectJournalPathsByDateInTree skips Archives subdirectory', async () => {
    const journalsRoot = path.join(tempDir, 'Journals')
    await fs.mkdir(path.join(journalsRoot, '2024', '06'), { recursive: true })
    await fs.writeFile(path.join(journalsRoot, '2024', '06', '2024-06-01.md'), '# diary')
    await fs.mkdir(path.join(journalsRoot, 'Archives', 'Weekly', '2025'), { recursive: true })
    await fs.writeFile(
      path.join(journalsRoot, 'Archives', 'Weekly', '2025', '2025-01-06.md'),
      '# summary'
    )

    const collected = await collectJournalPathsByDateInTree(fileSystem, journalsRoot)

    expect(collected.fileCount).toBe(1)
    expect(collected.pathsByDate.size).toBe(1)
    expect(collected.pathsByDate.has('2024-06-01')).toBe(true)
    expect(collected.pathsByDate.has('2025-01-06')).toBe(false)
  })

  it('isJournalPathUnderSkippedDir detects Archives in path', () => {
    expect(
      isJournalPathUnderSkippedDir('D:\\life-book\\2.日记\\Archives\\Weekly\\2025\\2025-01-06.md')
    ).toBe(true)
    expect(isJournalPathUnderSkippedDir('/vault/Journals/2024/06/2024-06-01.md')).toBe(false)
  })

  it('collectJournalPathsByDateInTree dedupes duplicate dates and prefers canonical layout', async () => {
    const journalsRoot = path.join(tempDir, 'Journals')
    const canonicalDir = path.join(journalsRoot, '2024', '06')
    await fs.mkdir(canonicalDir, { recursive: true })
    await fs.writeFile(path.join(journalsRoot, '2024-06-01.md'), '# flat')
    await fs.writeFile(path.join(canonicalDir, '2024-06-01.md'), '# canonical')

    const collected = await collectJournalPathsByDateInTree(fileSystem, journalsRoot)

    expect(collected.fileCount).toBe(2)
    expect(collected.pathsByDate.size).toBe(1)
    const preferred = collected.pathsByDate.get('2024-06-01')!
    expect(preferred.replace(/\\/g, '/')).toBe(
      path.resolve(canonicalDir, '2024-06-01.md').replace(/\\/g, '/')
    )
  })

  it('resolveShadowJournalAbsolutePath inverts shadow relative path from journal base parent', () => {
    const journalsBase = 'D:\\life-book\\1.人生书\\2.日记'
    const shadowPath = '2.日记/2024/06/2024-06-01.md'
    expect(
      path.resolve(resolveShadowJournalAbsolutePath(journalsBase, shadowPath)).replace(/\\/g, '/')
    ).toBe(
      path
        .resolve('D:\\life-book\\1.人生书', '2.日记', '2024', '06', '2024-06-01.md')
        .replace(/\\/g, '/')
    )
  })
})
