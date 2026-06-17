import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  hasFlutterLegacyDatabaseMarkers,
  isNextFormatArchiveManifest,
  resolveArchiveExtractRoot,
  shouldImportAsFlutterLegacyArchive
} from '../archive-import-detection.shared'

describe('archive-import-detection.shared', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-detect-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('detects Next manifest by formatVersion', () => {
    expect(isNextFormatArchiveManifest({ formatVersion: 1 })).toBe(true)
    expect(isNextFormatArchiveManifest({ schema_version: 1 })).toBe(false)
    expect(isNextFormatArchiveManifest(null)).toBe(false)
  })

  it('unwraps single nested legacy root directory', async () => {
    const nested = path.join(tempDir, 'BaiShou_Root')
    await fs.mkdir(path.join(nested, '.baishou'), { recursive: true })
    await fs.writeFile(path.join(nested, '.baishou', 'vault_registry.json'), '[]')

    const resolved = await resolveArchiveExtractRoot(fileSystem, tempDir)
    expect(resolved.replace(/\\/g, '/')).toBe(nested.replace(/\\/g, '/'))
  })

  it('treats Flutter physical zip as legacy when manifest is absent', async () => {
    const legacyRoot = path.join(tempDir, 'legacy')
    await fs.mkdir(path.join(legacyRoot, 'Personal', 'Journals'), { recursive: true })
    await fs.writeFile(path.join(legacyRoot, 'Personal', 'Journals', '2024-01-01.md'), '# hi')

    expect(await shouldImportAsFlutterLegacyArchive(fileSystem, legacyRoot, null)).toBe(true)
    expect(
      await shouldImportAsFlutterLegacyArchive(fileSystem, legacyRoot, { formatVersion: 1 })
    ).toBe(false)
  })

  it('treats Flutter zip with agent.sqlite as legacy even when manifest is present', async () => {
    const legacyRoot = path.join(tempDir, 'flutter_with_manifest')
    await fs.mkdir(path.join(legacyRoot, '.baishou'), { recursive: true })
    await fs.writeFile(path.join(legacyRoot, '.baishou', 'agent.sqlite'), 'sqlite-placeholder')

    expect(await hasFlutterLegacyDatabaseMarkers(fileSystem, legacyRoot)).toBe(true)
    expect(
      await shouldImportAsFlutterLegacyArchive(fileSystem, legacyRoot, { formatVersion: 1 })
    ).toBe(true)
  })
})
