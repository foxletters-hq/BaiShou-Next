import type { DerivedFreshnessService } from './derived-freshness.service'
import type {
  GraphCollection,
  RawSourceKind,
  RecordCollectionKindManager,
  ShardInfo,
  WholeFileKindManager,
  WriteOpts
} from './raw-data-source.types'

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

  getMemoryManager(): import('./managers/memory.raw-manager').MemoryRawManager | undefined {
    return this.recordManagers.get('memory') as
      | import('./managers/memory.raw-manager').MemoryRawManager
      | undefined
  }

  getGraphManager(): import('./managers/graph.raw-manager').GraphRawManager | undefined {
    return this.recordManagers.get('graph') as
      | import('./managers/graph.raw-manager').GraphRawManager
      | undefined
  }
}
