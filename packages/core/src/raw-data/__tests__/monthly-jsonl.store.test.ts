import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { MonthlyJsonlStore, collapseJsonlById, DIRTY_SHARD_HASH } from '../stores/monthly-jsonl.store'
import { isValidNotebookGraphShardKey } from '../notebook-graph-shard-key.util'

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
    expect(r1.contentHash).toBe(DIRTY_SHARD_HASH)

    const pending = await store.listPendingIndex()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.contentHash).toHaveLength(32)

    await store.markIndexed(r1.relativePath, pending[0]!.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(0)

    const r2 = await store.appendRecord('2026-07', {
      id: 'b',
      updatedAt: 2,
      content: 'world'
    })
    expect(r2.contentHash).toBe(DIRTY_SHARD_HASH)
    const pending2 = await store.listPendingIndex()
    expect(pending2).toHaveLength(1)
    expect(pending2[0]?.contentHash).not.toBe(pending[0]?.contentHash)
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
    const firstPending = await store.listPendingIndex()
    await store.markIndexed(written.relativePath, firstPending[0]!.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(0)

    const abs = store.shardAbsolutePath('2026-07')
    await fs.appendFile(abs, `${JSON.stringify({ id: 'b', updatedAt: 2 })}\n`, 'utf8')

    const pending = await store.listPendingIndex()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.contentHash).not.toBe(written.contentHash)
  })

  it('replaceShardContent rewrites file and keeps pending-index dirty', async () => {
    const written = await store.appendRecord('2026-07', {
      id: 'a',
      updatedAt: 1,
      content: 'hello'
    })
    const hashed = await store.listPendingIndex()
    await store.markIndexed(written.relativePath, hashed[0]!.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(0)

    const replaced = await store.replaceShardContent(
      '2026-07',
      `${JSON.stringify({ id: 'a', updatedAt: 2, content: 'merged' })}\n`
    )
    expect(replaced.contentHash).not.toBe(written.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(1)

    const rows = await store.readRecords('2026-07')
    expect(rows).toEqual([{ id: 'a', updatedAt: 2, content: 'merged' }])
  })

  it('defers shard MD5 until listPendingIndex / compact', async () => {
    const hashes: string[] = []
    const original = store.computeShardHash.bind(store)
    store.computeShardHash = async (month: string) => {
      hashes.push(month)
      return original(month)
    }
    for (let i = 0; i < 10; i++) {
      await store.appendRecord('2026-07', { id: `n${i}`, updatedAt: i + 1 })
    }
    expect(hashes).toHaveLength(0)
    await store.listPendingIndex()
    expect(hashes).toEqual(['2026-07'])
  })

  it('listShards skips MD5 when size and mtime are unchanged', async () => {
    await store.appendRecord('2026-07', { id: 'a', updatedAt: 1 })
    const hashes: string[] = []
    const original = store.computeShardHash.bind(store)
    store.computeShardHash = async (month: string) => {
      hashes.push(month)
      return original(month)
    }
    await store.listShards()
    expect(hashes).toEqual(['2026-07'])
    hashes.length = 0
    await store.listShards()
    expect(hashes).toEqual([])
  })

  it('markIndexed after a later append uses the current file hash', async () => {
    const first = await store.appendRecord('2026-07', { id: 'a', updatedAt: 1 })
    const pending = await store.listPendingIndex()
    const staleHash = pending[0]!.contentHash
    await store.appendRecord('2026-07', { id: 'b', updatedAt: 2 })
    await store.markIndexed(first.relativePath, staleHash)
    expect(await store.listPendingIndex()).toHaveLength(0)
    const rows = await store.readRecords('2026-07')
    expect(rows.map((r) => (r as { id: string }).id)).toEqual(['a', 'b'])
  })

  it('refreshShardHashAfterExternalWrite no-ops on an invalid key', async () => {
    await expect(store.refreshShardHashAfterExternalWrite('not a month')).resolves.toBe('')
  })

  it('external write force-pends even when content hash already matches indexedHash', async () => {
    const written = await store.appendRecord('2026-07', { id: 'a', updatedAt: 1 })
    const pending = await store.listPendingIndex()
    await store.markIndexed(written.relativePath, pending[0]!.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(0)

    await store.refreshShardHashAfterExternalWrite('2026-07')
    expect(await store.listPendingIndex()).toHaveLength(1)
  })

  it('invalidateIndexedHashes marks every indexed shard pending', async () => {
    const written = await store.appendRecord('2026-07', { id: 'a', updatedAt: 1 })
    const pending = await store.listPendingIndex()
    await store.markIndexed(written.relativePath, pending[0]!.contentHash)
    expect(await store.listPendingIndex()).toHaveLength(0)

    await store.invalidateIndexedHashes()
    expect(await store.listPendingIndex()).toHaveLength(1)
  })

  it('accepts injected sourceId keys and rejects calendar months', async () => {
    const notebookStore = new MonthlyJsonlStore({
      fs: new NodeFileSystem(),
      rootDir: tmpDir,
      isValidShardKey: isValidNotebookGraphShardKey
    })
    await expect(notebookStore.appendRecord('2026-07', { id: 'a', updatedAt: 1 })).rejects.toThrow(
      /Invalid shard key/
    )
    const written = await notebookStore.appendRecord('src_abc', { id: 'a', updatedAt: 1 })
    expect(written.relativePath).toBe('src_abc.jsonl')
    const pending = await notebookStore.listPendingIndex()
    expect(pending.map((s) => s.shardMonth)).toEqual(['src_abc'])
  })
})
