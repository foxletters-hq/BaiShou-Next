import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  countSummaryMarkdownInArchivesTreeByType,
  listMarkdownInSummaryTypeDir
} from '../summary-files.util'

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

  it('listMarkdownInSummaryTypeDir avoids per-file stat and ignores .nomedia and non-dir year files', async () => {
    const weeklyDir = path.join(tempDir, 'Weekly')
    await fs.writeFile(path.join(weeklyDir, '.nomedia'), '')
    await fs.writeFile(path.join(weeklyDir, '2024'), 'not-a-directory')
    await fs.writeFile(path.join(weeklyDir, '2025-12-29.md'), '# flat week')

    const statSpy = vi.spyOn(fileSystem, 'stat')
    try {
      const entries = await listMarkdownInSummaryTypeDir(fileSystem, weeklyDir)
      const names = entries.map((e) => e.fileName).sort()
      expect(names).toEqual(['2025-12-29.md', '2026-01-05.md'])
      expect(statSpy).not.toHaveBeenCalled()
    } finally {
      statSpy.mockRestore()
    }
  })
})
