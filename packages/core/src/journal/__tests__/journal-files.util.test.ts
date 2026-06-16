import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { journalMarkdownExistsInTree } from '../journal-files.util'

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
    expect(await journalMarkdownExistsInTree(fileSystem, path.join(tempDir, 'Journals'))).toBe(false)
  })
})
