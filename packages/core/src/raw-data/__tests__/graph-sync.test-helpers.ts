import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { GraphRawManager } from '../managers/graph.raw-manager'
import type { IStoragePathService } from '../../vault/storage-path.types'

export function nodeRecord(opts: {
  id: string
  vaultId: string
  name: string
  now: number
  shardMonth?: string
  summary?: string
  aliases?: string[]
}) {
  return {
    id: opts.id,
    schemaVersion: 1 as const,
    vaultId: opts.vaultId,
    vaultName: 'Personal',
    nodeType: 'person',
    name: opts.name,
    aliases: opts.aliases ?? ([] as string[]),
    summary: opts.summary ?? '',
    props: {},
    mentionCount: 1,
    firstSeenAt: opts.now,
    lastSeenAt: opts.now,
    origin: 'ai' as const,
    shardMonth: opts.shardMonth ?? '2026-07',
    createdAt: opts.now,
    updatedAt: opts.now,
    deletedAt: null,
    reviewStatus: 'pending' as const
  }
}

export async function createGraphSyncHarness() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-sync-'))
  const freshness = new DerivedFreshnessService()
  const pathService = {
    getGraphBaseDirectory: async () => path.join(tmpDir, 'Graph')
  } as unknown as IStoragePathService
  const graphManager = new GraphRawManager(pathService, new NodeFileSystem(), freshness)
  return {
    tmpDir,
    graphManager,
    cleanup: async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  }
}
