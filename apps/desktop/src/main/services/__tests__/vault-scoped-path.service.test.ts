import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesktopStoragePathService } from '../path.service'
import { VaultScopedStoragePathService } from '../vault-scoped-path.service'

describe('VaultScopedStoragePathService', () => {
  let tempRoot: string
  let vaultDir: string
  let externalJournalsDir: string
  let externalSummariesDir: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-scoped-path-'))
    vaultDir = path.join(tempRoot, 'Personal')
    externalJournalsDir = path.join(tempRoot, 'external-journals')
    externalSummariesDir = path.join(tempRoot, 'external-summaries')
    await fs.mkdir(vaultDir, { recursive: true })
    await fs.mkdir(externalJournalsDir, { recursive: true })
    await fs.mkdir(externalSummariesDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('should resolve configured external journals directory when available on disk', async () => {
    const base = {
      getVaultDirectory: vi.fn().mockResolvedValue(vaultDir),
      getExternalJournalsDirectory: vi.fn().mockResolvedValue(externalJournalsDir)
    } as unknown as DesktopStoragePathService

    const scoped = new VaultScopedStoragePathService(base, 'Personal')
    const resolved = await scoped.getJournalsBaseDirectory()

    expect(resolved).toBe(externalJournalsDir)
    expect(base.getExternalJournalsDirectory).toHaveBeenCalledWith('Personal')
  })

  it('should fall back to internal vault Journals directory when external directory is missing on disk', async () => {
    const missingDir = path.join(tempRoot, 'non-existent-external')
    const base = {
      getVaultDirectory: vi.fn().mockResolvedValue(vaultDir),
      getExternalJournalsDirectory: vi.fn().mockResolvedValue(missingDir)
    } as unknown as DesktopStoragePathService

    const scoped = new VaultScopedStoragePathService(base, 'Personal')
    const resolved = await scoped.getJournalsBaseDirectory()

    expect(resolved).toBe(path.join(vaultDir, 'Journals'))
  })

  it('should resolve configured external summaries directory when available on disk', async () => {
    const base = {
      getVaultDirectory: vi.fn().mockResolvedValue(vaultDir),
      getExternalSummariesDirectory: vi.fn().mockResolvedValue(externalSummariesDir)
    } as unknown as DesktopStoragePathService

    const scoped = new VaultScopedStoragePathService(base, 'Personal')
    const resolved = await scoped.getSummariesBaseDirectory()

    expect(resolved).toBe(externalSummariesDir)
    expect(base.getExternalSummariesDirectory).toHaveBeenCalledWith('Personal')
  })

  it('should resolve diary attachment directory under external journals directory when configured', async () => {
    const base = {
      getVaultDirectory: vi.fn().mockResolvedValue(vaultDir),
      getExternalJournalsDirectory: vi.fn().mockResolvedValue(externalJournalsDir)
    } as unknown as DesktopStoragePathService

    const scoped = new VaultScopedStoragePathService(base, 'Personal')
    const attachmentDir = await scoped.getDiaryAttachmentDirectoryByYearMonth('2026-11')

    expect(attachmentDir).toBe(path.join(externalJournalsDir, '2026', '11', 'attachment'))
  })
})
