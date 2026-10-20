import { describe } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { NotebookRawManager } from '../../raw-data/managers/notebook.raw-manager'
import type { IStoragePathService } from '../../vault/storage-path.types'

export function canOpenBetterSqlite3(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3')
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}

export const describeHydration = canOpenBetterSqlite3() ? describe : describe.skip

export type KnowledgeHydrationContext = {
  tempDir: string
  notebooksDir: string
  repo: import('@baishou/database').KnowledgeRepository
  notebookManager: NotebookRawManager
  cleanup: () => void
}

export async function setupKnowledgeHydration(): Promise<KnowledgeHydrationContext> {
  const { KnowledgeConnectionManager, KnowledgeRepository } = await import('@baishou/database')
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-kb-hydrate-'))
  const notebooksDir = path.join(tempDir, 'Notebooks')
  await fs.mkdir(notebooksDir, { recursive: true })

  const dbManager = new KnowledgeConnectionManager()
  await dbManager.connect(tempDir)
  const repo = new KnowledgeRepository(dbManager.getDb())

  const fsApi = createNodeFileSystem()
  const pathService = {
    getNotebooksBaseDirectory: async () => notebooksDir,
    getActiveVaultPath: async () => tempDir
  } as unknown as IStoragePathService
  const notebookManager = new NotebookRawManager(pathService, fsApi)

  return {
    tempDir,
    notebooksDir,
    repo,
    notebookManager,
    cleanup: () => dbManager.disconnect()
  }
}
