import { md5Hex } from '../../fs/md5'
import * as path from '../../fs/path.util'
import type { IFileSystem } from '../../fs/file-system.types'
import type { ShardInfo, ShardsManifest } from '../raw-data-source.types'
import { isValidShardMonth } from '../raw-data-month.util'
import { pickWinner, type JsonlMergeableRecord } from '../jsonl-record-merge.service'

const MANIFEST_NAME = 'shards.manifest.json'

export interface MonthlyJsonlStoreOptions {
  fs: IFileSystem
  /** Absolute directory for this collection root (e.g. Memory/ or Graph/nodes/) */
  rootDir: string
}

/**
 * Monthly JSONL shards + shards.manifest.json (MD5 content hashes).
 * Append-only rows; LWW at read time by id/updatedAt.
 */
export class MonthlyJsonlStore {
  constructor(private readonly options: MonthlyJsonlStoreOptions) {}

  private get fs(): IFileSystem {
    return this.options.fs
  }

  private get rootDir(): string {
    return this.options.rootDir
  }

  private manifestPath(): string {
    return path.join(this.rootDir, MANIFEST_NAME)
  }

  private shardFileName(shardMonth: string): string {
    return `${shardMonth}.jsonl`
  }

  shardRelativePath(shardMonth: string): string {
    return this.shardFileName(shardMonth)
  }

  shardAbsolutePath(shardMonth: string): string {
    return path.join(this.rootDir, this.shardFileName(shardMonth))
  }

  async ensureRoot(): Promise<void> {
    await this.fs.mkdir(this.rootDir, { recursive: true })
  }

  async readManifest(): Promise<ShardsManifest> {
    const file = this.manifestPath()
    if (!(await this.fs.exists(file))) {
      return { schemaVersion: 1, updatedAt: Date.now(), shards: {} }
    }
    try {
      const raw = await this.fs.readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as ShardsManifest
      if (!parsed || typeof parsed !== 'object') {
        return { schemaVersion: 1, updatedAt: Date.now(), shards: {} }
      }
      return {
        schemaVersion: 1,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        shards: parsed.shards && typeof parsed.shards === 'object' ? parsed.shards : {}
      }
    } catch {
      return { schemaVersion: 1, updatedAt: Date.now(), shards: {} }
    }
  }

  async writeManifest(manifest: ShardsManifest): Promise<void> {
    await this.ensureRoot()
    await this.fs.writeFile(
      this.manifestPath(),
      JSON.stringify({ ...manifest, schemaVersion: 1, updatedAt: Date.now() }, null, 2),
      'utf8'
    )
  }

  async computeShardHash(shardMonth: string): Promise<string> {
    const file = this.shardAbsolutePath(shardMonth)
    if (!(await this.fs.exists(file))) return md5Hex('')
    const content = await this.fs.readFile(file, 'utf8')
    return md5Hex(content)
  }

  async appendRecord(shardMonth: string, record: unknown): Promise<{
    shardPath: string
    relativePath: string
    contentHash: string
  }> {
    if (!isValidShardMonth(shardMonth)) {
      throw new Error(`Invalid shard month: ${shardMonth}`)
    }
    await this.ensureRoot()
    const abs = this.shardAbsolutePath(shardMonth)
    const line = `${JSON.stringify(record)}\n`
    await this.fs.appendFile(abs, line, 'utf8')
    const contentHash = await this.computeShardHash(shardMonth)
    const manifest = await this.readManifest()
    const rel = this.shardRelativePath(shardMonth)
    const prev = manifest.shards[rel]
    manifest.shards[rel] = {
      contentHash,
      indexedHash: prev?.indexedHash
    }
    await this.writeManifest(manifest)
    return { shardPath: abs, relativePath: rel, contentHash }
  }

  async readRecords(shardMonth: string): Promise<unknown[]> {
    const file = this.shardAbsolutePath(shardMonth)
    if (!(await this.fs.exists(file))) return []
    const content = await this.fs.readFile(file, 'utf8')
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as unknown
        } catch {
          return null
        }
      })
      .filter((row) => row != null)
  }

  async readRecordsByRelativePath(relativePath: string): Promise<unknown[]> {
    const month = relativePath.replace(/\.jsonl$/i, '').split(/[/\\]/).pop() ?? ''
    if (!isValidShardMonth(month)) return []
    return this.readRecords(month)
  }

  async listShards(): Promise<ShardInfo[]> {
    await this.ensureRoot()
    const manifest = await this.readManifest()
    const names = await this.fs.readdir(this.rootDir).catch((e: NodeJS.ErrnoException) => {
      if (e?.code === 'ENOENT') return [] as string[]
      throw e
    })

    const months = names
      .filter((n) => n.endsWith('.jsonl'))
      .map((n) => n.replace(/\.jsonl$/i, ''))
      .filter(isValidShardMonth)

    const result: ShardInfo[] = []
    for (const month of months) {
      const rel = this.shardRelativePath(month)
      // Always recompute from disk so external writes (sync LWW / download) invalidate pending-index
      const contentHash = await this.computeShardHash(month)
      const prev = manifest.shards[rel]
      manifest.shards[rel] = {
        contentHash,
        indexedHash: prev?.indexedHash
      }
      result.push({
        path: this.shardAbsolutePath(month),
        relativePath: rel,
        contentHash,
        shardMonth: month
      })
    }
    await this.writeManifest(manifest)
    return result.sort((a, b) => a.shardMonth.localeCompare(b.shardMonth))
  }

  /**
   * Atomically rewrite a whole monthly shard (e.g. sync LWW merge).
   * Updates contentHash and keeps indexedHash so pending-index stays dirty until re-hydrated.
   */
  async replaceShardContent(
    shardMonth: string,
    content: string
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string }> {
    if (!isValidShardMonth(shardMonth)) {
      throw new Error(`Invalid shard month: ${shardMonth}`)
    }
    await this.ensureRoot()
    const abs = this.shardAbsolutePath(shardMonth)
    const text = content.endsWith('\n') || content.length === 0 ? content : `${content}\n`
    await this.fs.writeFile(abs, text, 'utf8')
    const contentHash = await this.computeShardHash(shardMonth)
    const manifest = await this.readManifest()
    const rel = this.shardRelativePath(shardMonth)
    const prev = manifest.shards[rel]
    manifest.shards[rel] = {
      contentHash,
      indexedHash: prev?.indexedHash
    }
    await this.writeManifest(manifest)
    return { shardPath: abs, relativePath: rel, contentHash }
  }

  /**
   * After an out-of-band rewrite of a shard file, refresh contentHash and keep indexedHash
   * so listPendingIndex reports dirty until re-hydrated.
   */
  async refreshShardHashAfterExternalWrite(shardMonth: string): Promise<string> {
    if (!isValidShardMonth(shardMonth)) {
      throw new Error(`Invalid shard month: ${shardMonth}`)
    }
    const contentHash = await this.computeShardHash(shardMonth)
    const manifest = await this.readManifest()
    const rel = this.shardRelativePath(shardMonth)
    const prev = manifest.shards[rel]
    manifest.shards[rel] = {
      contentHash,
      indexedHash: prev?.indexedHash
    }
    await this.writeManifest(manifest)
    return contentHash
  }

  async markIndexed(relativePath: string, contentHash: string): Promise<void> {
    const manifest = await this.readManifest()
    const prev = manifest.shards[relativePath] ?? { contentHash }
    manifest.shards[relativePath] = {
      ...prev,
      contentHash: prev.contentHash || contentHash,
      indexedHash: contentHash
    }
    await this.writeManifest(manifest)
  }

  /** Shards whose file hash differs from last indexed hash. */
  async listPendingIndex(): Promise<ShardInfo[]> {
    const shards = await this.listShards()
    const manifest = await this.readManifest()
    return shards.filter((shard) => {
      const entry = manifest.shards[shard.relativePath]
      return !entry?.indexedHash || entry.indexedHash !== shard.contentHash
    })
  }
}

/**
 * Collapse append-only JSONL rows by id using the same LWW rules as sync merge
 * (higher updatedAt; same stamp → tombstone wins).
 */
export function collapseJsonlById<
  T extends { id: string; updatedAt: number; deletedAt?: number | null }
>(rows: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    if (!row?.id) continue
    const prev = map.get(row.id)
    if (!prev) {
      map.set(row.id, row)
      continue
    }
    map.set(
      row.id,
      pickWinner(prev as JsonlMergeableRecord, row as JsonlMergeableRecord) as T
    )
  }
  return [...map.values()]
}
