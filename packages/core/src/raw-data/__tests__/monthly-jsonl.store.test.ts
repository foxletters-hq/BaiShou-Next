import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { MonthlyJsonlStore, collapseJsonlById } from '../stores/monthly-jsonl.store'

describe('MonthlyJsonlStore', () => {
  let tmpDir: string
  let store: MonthlyJsonlStore

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-jsonl-'))
    store = new MonthlyJsonlStore({ fs: new NodeFileSystem(), rootDir: tmpDir })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('appends records and updates manifest hash', async () => {
    const r1 = await store.appendRecord('2026-07', {
      id: 'a',
      updatedAt: 1,
      content: 'hello'
    })
    expect(r1.relativePath).toBe('2026-07.jsonl')
    expect(r1.contentHash).toHaveLength(32)

    const pending = await store.listPendingIndex()
    expect(pending).toHaveLength(1)

    await store.markIndexed(r1.relativePath, r1.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(0)

    const r2 = await store.appendRecord('2026-07', {
      id: 'b',
      updatedAt: 2,
      content: 'world'
    })
    expect(r2.contentHash).not.toBe(r1.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(1)
  })

  it('collapseJsonlById keeps newest updatedAt', () => {
    const rows = collapseJsonlById([
      { id: 'x', updatedAt: 1, content: 'old' },
      { id: 'x', updatedAt: 3, content: 'new' },
      { id: 'x', updatedAt: 2, content: 'mid' }
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.content).toBe('new')
  })

  it('collapseJsonlById prefers tombstone on equal updatedAt', () => {
    const rows = collapseJsonlById([
      { id: 'x', updatedAt: 5, deletedAt: null, content: 'live' },
      { id: 'x', updatedAt: 5, deletedAt: 5, content: 'dead' }
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.deletedAt).toBe(5)
  })

  it('external rewrite makes shard pending-index again', async () => {
    const written = await store.appendRecord('2026-07', {
      id: 'a',
      updatedAt: 1,
      content: 'hello'
    })
    await store.markIndexed(written.relativePath, written.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(0)

    const abs = store.shardAbsolutePath('2026-07')
    await fs.appendFile(abs, `${JSON.stringify({ id: 'b', updatedAt: 2 })}\n`, 'utf8')

    const pending = await store.listPendingIndex()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.contentHash).not.toBe(written.contentHash)
  })
})
