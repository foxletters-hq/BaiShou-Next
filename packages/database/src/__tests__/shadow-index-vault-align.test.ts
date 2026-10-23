import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { deriveLegacyVaultId } from '@baishou/shared'
import { ShadowIndexConnectionManager } from '../shadow-index.connection.manager'
import { ShadowIndexRepository } from '../repositories/shadow-index.repository'
import { alignShadowJournalVaultId } from '../shadow-index-vault-align'
import type { UpsertShadowIndexPayload } from '../repositories/shadow-index.repository.types'

const VAULT_NAME = '演示空间_265'
const VAULT_ID = 'vlt_7a014717808cdf91'

function dummyPayload(dateIso: string, text: string): UpsertShadowIndexPayload {
  return {
    date: dateIso,
    createdAt: dateIso,
    updatedAt: dateIso,
    contentHash: `hash-${dateIso}`,
    isFavorite: false,
    hasMedia: false,
    rawContent: text,
    tags: '',
    filePath: `Journals/${dateIso.split('T')[0]}.md`
  }
}

describe('alignShadowJournalVaultId', () => {
  let manager: ShadowIndexConnectionManager
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-shadow-align-'))
    manager = new ShadowIndexConnectionManager()
    await manager.connect(tempDir)
  })

  afterEach(async () => {
    await manager.disconnect()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('should list journals by vault id after aligning name-keyed rows', async () => {
    const nameRepo = new ShadowIndexRepository(manager.getDb(), VAULT_NAME)
    await nameRepo.upsert(dummyPayload('2026-07-29T00:00:00.000Z', 'name keyed diary'))

    const idRepoBefore = new ShadowIndexRepository(manager.getDb(), VAULT_ID)
    expect(await idRepoBefore.listAll()).toHaveLength(0)

    const moved = await alignShadowJournalVaultId(manager.getDb(), {
      id: VAULT_ID,
      name: VAULT_NAME
    })

    expect(moved).toBe(1)
    const idRepo = new ShadowIndexRepository(manager.getDb(), VAULT_ID)
    const rows = await idRepo.listAll()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.filePath).toBe('Journals/2026-07-29.md')
    expect(rows[0]?.contentHash).toBe('hash-2026-07-29T00:00:00.000Z')
    expect(await nameRepo.listAll()).toHaveLength(0)
  })

  it('should move deriveLegacyVaultId rows onto the registry vault id', async () => {
    const legacyId = deriveLegacyVaultId(VAULT_NAME)
    const legacyRepo = new ShadowIndexRepository(manager.getDb(), legacyId)
    await legacyRepo.upsert(dummyPayload('2026-08-01T00:00:00.000Z', 'legacy keyed diary'))

    await alignShadowJournalVaultId(manager.getDb(), { id: VAULT_ID, name: VAULT_NAME })

    const idRepo = new ShadowIndexRepository(manager.getDb(), VAULT_ID)
    expect(await idRepo.listAll()).toHaveLength(1)
    expect(await legacyRepo.listAll()).toHaveLength(0)
  })

  it('should keep the destination row when the same file path exists under both keys', async () => {
    const payload = dummyPayload('2026-07-28T00:00:00.000Z', 'id keyed wins')
    const nameRepo = new ShadowIndexRepository(manager.getDb(), VAULT_NAME)
    const idRepo = new ShadowIndexRepository(manager.getDb(), VAULT_ID)
    await nameRepo.upsert({ ...payload, rawContent: 'stale name row', contentHash: 'hash-name' })
    await idRepo.upsert({ ...payload, rawContent: 'canonical id row', contentHash: 'hash-id' })

    await alignShadowJournalVaultId(manager.getDb(), { id: VAULT_ID, name: VAULT_NAME })

    const rows = await idRepo.listAll()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.contentHash).toBe('hash-id')
    expect(await nameRepo.listAll()).toHaveLength(0)
  })

  it('should not change rows when name already equals id', async () => {
    const repo = new ShadowIndexRepository(manager.getDb(), VAULT_ID)
    await repo.upsert(dummyPayload('2026-07-27T00:00:00.000Z', 'already aligned'))

    const moved = await alignShadowJournalVaultId(manager.getDb(), {
      id: VAULT_ID,
      name: VAULT_ID
    })

    expect(moved).toBe(0)
    expect(await repo.listAll()).toHaveLength(1)
  })

  it('should not touch a different vault when aligning the active vault', async () => {
    const otherRepo = new ShadowIndexRepository(manager.getDb(), 'other-vault')
    await otherRepo.upsert(dummyPayload('2026-07-26T00:00:00.000Z', 'other vault'))
    const nameRepo = new ShadowIndexRepository(manager.getDb(), VAULT_NAME)
    await nameRepo.upsert(dummyPayload('2026-07-25T00:00:00.000Z', 'active vault'))

    await alignShadowJournalVaultId(manager.getDb(), { id: VAULT_ID, name: VAULT_NAME })

    expect(await otherRepo.listAll()).toHaveLength(1)
    const idRepo = new ShadowIndexRepository(manager.getDb(), VAULT_ID)
    expect(await idRepo.listAll()).toHaveLength(1)
  })
})
