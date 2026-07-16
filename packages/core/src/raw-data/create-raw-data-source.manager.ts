import type { IFileSystem } from '../fs/file-system.types'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { IVersionManager } from '../sync/version-manager.interface'
import { DerivedFreshnessService } from './derived-freshness.service'
import { GraphRawManager } from './managers/graph.raw-manager'
import { MemoryRawManager } from './managers/memory.raw-manager'
import { WholeFileRawManager } from './managers/whole-file.raw-manager'
import { RawDataSourceManager } from './raw-data-source.manager'

export interface CreateRawDataSourceManagerOptions {
  pathService: IStoragePathService
  fs: IFileSystem
  versionManager?: IVersionManager
  maxVersionsPerFile?: number
}

export function createRawDataSourceManager(
  options: CreateRawDataSourceManagerOptions
): {
  manager: RawDataSourceManager
  freshness: DerivedFreshnessService
  memoryManager: MemoryRawManager
  graphManager: GraphRawManager
} {
  const freshness = new DerivedFreshnessService()
  const manager = new RawDataSourceManager(freshness)
  const memoryManager = new MemoryRawManager(options.pathService, options.fs, freshness)
  const graphManager = new GraphRawManager(options.pathService, options.fs, freshness)
  manager.registerRecord(memoryManager)
  manager.registerRecord(graphManager)

  const maxVersions = options.maxVersionsPerFile ?? 20
  for (const kind of ['journal', 'summary', 'session'] as const) {
    manager.registerFile(
      new WholeFileRawManager(
        kind,
        options.pathService,
        options.fs,
        options.versionManager,
        maxVersions
      )
    )
  }

  return { manager, freshness, memoryManager, graphManager }
}
