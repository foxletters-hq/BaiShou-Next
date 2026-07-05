import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  collectScoredLegacyRootCandidates,
  detectFlutterLegacyMigrationPending,
  evaluateLegacyRootCandidate,
  LEGACY_ROOT_MIN_CONFIDENCE_SCORE
} from '../legacy-root-detection.shared'
import { isLegacyAppRoot } from '../legacy-migration.shared'
import { writeBsV3Fixture } from '../legacy-migration.fixture'
import * as workspaceRoot from '../../storage/workspace-root.util'

describe('legacy-root-detection.shared', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-root-detection-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('rejects journal-only detection when path is treated as filesystem root', async () => {
    const pseudoDrive = path.join(tempDir, 'pseudo-drive')
    await fs.mkdir(path.join(pseudoDrive, 'Personal', 'Journals'), { recursive: true })
    await fs.writeFile(path.join(pseudoDrive, 'Personal', 'Journals', '2024-01-01.md'), '# x')

    const spy = vi.spyOn(workspaceRoot, 'isFilesystemRootPath').mockReturnValue(true)
    expect(await isLegacyAppRoot(fileSystem, pseudoDrive)).toBe(false)
    spy.mockRestore()
  })

  it('accepts flutter sp path only when strong markers exist', async () => {
    const emptyRoot = path.join(tempDir, 'empty-sp-root')
    await fs.mkdir(emptyRoot, { recursive: true })

    const evaluated = await evaluateLegacyRootCandidate(fileSystem, emptyRoot, {
      fromFlutterSp: true
    })
    expect(evaluated).toBeNull()
  })

  it('scores legacy fixture with strong markers highly', async () => {
    const legacyRoot = path.join(tempDir, 'legacy')
    await writeBsV3Fixture(legacyRoot)

    const scored = await collectScoredLegacyRootCandidates(fileSystem, [
      { path: legacyRoot, fromFlutterSp: true }
    ])

    expect(scored).toHaveLength(1)
    expect(scored[0]?.hasStrongMarkers).toBe(true)
    expect(scored[0]?.score).toBeGreaterThanOrEqual(LEGACY_ROOT_MIN_CONFIDENCE_SCORE)
  })

  it('detects in-place legacy upgrade when source equals current workspace root', async () => {
    const legacyRoot = path.join(tempDir, 'BaiShou_Root')
    await writeBsV3Fixture(legacyRoot)

    const pending = await detectFlutterLegacyMigrationPending(fileSystem, {
      targetRoot: legacyRoot,
      installInstanceId: 'install-a',
      rawCandidates: [{ path: legacyRoot, fromFlutterSp: false }]
    })

    expect(pending).not.toBeNull()
    expect(pending?.inPlace).toBe(true)
    expect(pending?.sourceRoot).toBe(legacyRoot)
    expect(pending?.targetRoot).toBe(legacyRoot)
  })

  it('detects cross-directory migration when legacy root differs from workspace root', async () => {
    const legacyRoot = path.join(tempDir, 'legacy')
    const targetRoot = path.join(tempDir, 'next-vaults')
    await writeBsV3Fixture(legacyRoot)
    await fs.mkdir(targetRoot, { recursive: true })

    const pending = await detectFlutterLegacyMigrationPending(fileSystem, {
      targetRoot,
      installInstanceId: 'install-a',
      rawCandidates: [{ path: legacyRoot, fromFlutterSp: false }]
    })

    expect(pending).not.toBeNull()
    expect(pending?.inPlace).toBe(false)
    expect(pending?.sourceRoot).toBe(legacyRoot)
    expect(pending?.targetRoot).toBe(legacyRoot)
  })
})
