import type { DerivedFreshnessService } from './derived-freshness.service'
import { classifyMonthlyJsonlPath } from './monthly-jsonl-path.util'
import type {
  GraphCollection,
  RawSourceKind,
  RecordCollectionKindManager,
  ShardInfo,
  WholeFileKindManager,
  WriteOpts
} from './raw-data-source.types'
import type { MemoryRawManager } from './managers/memory.raw-manager'
import type { GraphRawManager } from './managers/graph.raw-manager'

const RECORD_KINDS = new Set(['memory', 'graph'])
const FILE_KINDS = new Set(['journal', 'summary', 'session', 'notebook'])

/**
 * Facade: whitelist raw-data write entry. Routes to kind managers.
 */
export class RawDataSourceManager {
  private readonly recordManagers = new Map<string, RecordCollectionKindManager>()
  private readonly fileManagers = new Map<string, WholeFileKindManager>()

  constructor(readonly freshness: DerivedFreshnessService) {}

  registerRecord(impl: RecordCollectionKindManager): void {
    this.recordManagers.set(impl.kind, impl)
  }

  registerFile(impl: WholeFileKindManager): void {
    this.fileManagers.set(impl.kind, impl)
  }

  async writeRecord(
    kind: 'memory' | 'graph',
    record: unknown,
    opts?: { collection?: GraphCollection } & WriteOpts
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string }> {
    const mgr = this.recordManagers.get(kind)
    if (!mgr) throw new Error(`RawDataSourceManager: no record manager for ${kind}`)
    return mgr.writeRecord(record, opts)
  }

  async writeFile(
    kind: 'journal' | 'summary' | 'session' | 'notebook',
    relativePath: string,
    content: string | Uint8Array,
    opts?: WriteOpts
  ): Promise<{ contentHash: string }> {
    if (!FILE_KINDS.has(kind)) {
      throw new Error(`RawDataSourceManager: ${kind} is not a whole-file kind`)
    }
    const mgr = this.fileManagers.get(kind)
    if (!mgr) throw new Error(`RawDataSourceManager: no file manager for ${kind}`)
    return mgr.writeFile(relativePath, content, opts)
  }

  async tombstone(
    kind: 'memory' | 'graph',
    id: string,
    opts: WriteOpts & { collection?: GraphCollection; shardMonth?: string }
  ): Promise<void> {
    const mgr = this.recordManagers.get(kind)
    if (!mgr) throw new Error(`RawDataSourceManager: no record manager for ${kind}`)
    return mgr.tombstone(id, opts)
  }

  async listShards(kind: RawSourceKind): Promise<ShardInfo[]> {
    if (RECORD_KINDS.has(kind)) {
      const mgr = this.recordManagers.get(kind)
      if (!mgr) return []
      return mgr.listShards()
    }
    return []
  }

  getRecordManager(kind: 'memory' | 'graph'): RecordCollectionKindManager | undefined {
    return this.recordManagers.get(kind)
  }

  getMemoryManager(): MemoryRawManager | undefined {
    return this.recordManagers.get('memory') as MemoryRawManager | undefined
  }

  getGraphManager(): GraphRawManager | undefined {
    return this.recordManagers.get('graph') as GraphRawManager | undefined
  }

  /**
   * Atomically rewrite a Memory/Graph monthly JSONL shard via the owning manager.
   * Used by three-way sync LWW merge. Returns false when path is not a monthly JSONL shard
   * or the manager is not registered.
   */
  async replaceMonthlyJsonlShard(relPath: string, content: string): Promise<boolean> {
    const classified = classifyMonthlyJsonlPath(relPath)
    if (!classified) return false
    if (classified.kind === 'memory') {
      const mgr = this.getMemoryManager()
      if (!mgr) return false
      await mgr.replaceShardContent(classified.shardMonth, content)
      return true
    }
    const mgr = this.getGraphManager()
    if (!mgr) return false
    await mgr.replaceShardContent(classified.collection, classified.shardMonth, content)
    return true
  }
}
