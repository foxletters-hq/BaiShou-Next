import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  isValidNextArchiveManifest,
  isValidNextArchiveManifestContent,
  resolveArchivePayloadRoot
} from '../archive-manifest.util'

describe('archive-manifest.util', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-manifest-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('accepts valid Next manifest', () => {
    expect(isValidNextArchiveManifest({ formatVersion: 1 })).toBe(true)
    expect(isValidNextArchiveManifestContent('{"formatVersion":1}')).toBe(true)
    expect(isValidNextArchiveManifest({})).toBe(false)
    expect(isValidNextArchiveManifestContent('{}')).toBe(false)
  })

  it('unwraps single nested legacy folder in extracted zip', async () => {
    const extractDir = path.join(tempDir, 'extract')
    const nested = path.join(extractDir, 'BaiShou_Vault_Backup_20260101')
    await fs.mkdir(path.join(nested, '.baishou'), { recursive: true })
    await fs.writeFile(path.join(nested, '.baishou', 'vault_registry.json'), '[]')

    const resolved = await resolveArchivePayloadRoot(fileSystem, extractDir)
    expect(resolved.replace(/\\/g, '/')).toBe(nested.replace(/\\/g, '/'))
  })
})
