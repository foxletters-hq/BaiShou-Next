import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { countSummaryMarkdownInArchivesTreeByType } from '../summary-files.util'

describe('summary-files.util', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-summary-files-'))
    await fs.mkdir(path.join(tempDir, 'Weekly', '2026'), { recursive: true })
    await fs.mkdir(path.join(tempDir, 'Monthly', '2025'), { recursive: true })
    await fs.mkdir(path.join(tempDir, 'Yearly'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'Weekly', '2026', '2026-01-05.md'), '# week')
    await fs.writeFile(path.join(tempDir, 'Monthly', '2025', '2025-11-01.md'), '# month')
    await fs.writeFile(path.join(tempDir, 'Yearly', '2025-01-01.md'), '# year')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('countSummaryMarkdownInArchivesTreeByType returns per-type totals', async () => {
    await expect(countSummaryMarkdownInArchivesTreeByType(fileSystem, tempDir)).resolves.toEqual({
      total: 3,
      weekly: 1,
      monthly: 1,
      quarterly: 0,
      yearly: 1
    })
  })
})
