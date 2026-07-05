import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  patchVaultExternalPaths,
  readVaultExternalPaths,
  resolveJournalsBaseDirectory,
  resolveSummariesBaseDirectory
} from '../vault-external-paths.service'

describe('vault-external-paths.service', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-external-paths-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('resolves default Journals and Archives under vault', () => {
    expect(resolveJournalsBaseDirectory('/data/Personal', {})).toBe('/data/Personal/Journals')
    expect(resolveSummariesBaseDirectory('/data/Personal', {})).toBe('/data/Personal/Archives')
  })

  it('resolves custom external directories', () => {
    expect(
      resolveJournalsBaseDirectory('/data/Personal', {
        journalsDirectory: 'D:/obsidian/2.日记'
      })
    ).toBe('D:/obsidian/2.日记')
    expect(
      resolveSummariesBaseDirectory('/data/Personal', {
        summariesDirectory: 'D:/obsidian/9.归档内容'
      })
    ).toBe('D:/obsidian/9.归档内容')
  })

  it('patches journals and summaries independently', async () => {
    const sysDir = path.join(tempDir, 'Personal', '.baishou')
    await patchVaultExternalPaths(fileSystem, sysDir, {
      journalsDirectory: 'D:/life-book/2.日记'
    })
    await patchVaultExternalPaths(fileSystem, sysDir, {
      summariesDirectory: 'D:/life-book/9.归档内容'
    })

    const read = await readVaultExternalPaths(fileSystem, sysDir)
    expect(read.journalsDirectory).toBe('D:/life-book/2.日记')
    expect(read.summariesDirectory).toBe('D:/life-book/9.归档内容')

    await patchVaultExternalPaths(fileSystem, sysDir, { summariesDirectory: null })
    const afterClear = await readVaultExternalPaths(fileSystem, sysDir)
    expect(afterClear.journalsDirectory).toBe('D:/life-book/2.日记')
    expect(afterClear.summariesDirectory).toBeUndefined()
  })
})
