import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { graphNodeCardText, type NotebookGraphNodeRawRecord } from '@baishou/shared'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import type { IStoragePathService } from '../../vault/storage-path.types'
import { NotebookGraphRawManager } from '../notebook-graph-raw.manager'
import { NotebookGraphIndexService } from '../notebook-graph-index.service'

function makeNode(
  id: string,
  name: string,
  now: number,
  opts?: { summary?: string; nodeType?: string }
): NotebookGraphNodeRawRecord {
  return {
    id,
    schemaVersion: 1,
    vaultId: 'v1',
    vaultName: 'Personal',
    notebookId: 'nb1',
    nodeType: opts?.nodeType ?? 'person',
    name,
    aliases: [],
    summary: opts?.summary ?? '',
    props: {},
    mentionCount: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    origin: 'ai',
    shardMonth: 'src1',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reviewStatus: 'approved'
  }
}

describe('NotebookGraphIndexService card-change embed', () => {
  let tempDir: string
  let raw: NotebookGraphRawManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-nb-graph-embed-'))
    const notebooksDir = path.join(tempDir, 'Notebooks')
    await fs.mkdir(notebooksDir, { recursive: true })
    raw = new NotebookGraphRawManager(
      {
        getNotebooksBaseDirectory: async () => notebooksDir
      } as unknown as IStoragePathService,
      createNodeFileSystem()
    )
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('should re-embed when the live node summary changed the card', async () => {
    const now = Date.now()
    await raw.writeNode(makeNode('n1', '张三', now, { summary: '大学同学' }))
    const embedQuery = vi.fn().mockResolvedValue([0.3, 0.4])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue({
        id: 'n1',
        name: '张三',
        summary: '同事',
        modelId: 'embed-v1',
        dimension: 2
      }),
      applyRawNode,
      applyRawEdge: vi.fn(),
      listLiveIds: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
      softDeleteNode: vi.fn(),
      softDeleteEdge: vi.fn()
    }

    await new NotebookGraphIndexService(raw, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1', absentSweep: 'off' })

    expect(embedQuery).toHaveBeenCalledTimes(1)
    expect(embedQuery).toHaveBeenCalledWith(graphNodeCardText('张三', '大学同学'))
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', embedding: [0.3, 0.4], modelId: 'embed-v1' })
    )
  })

  it('should skip embedQuery when only aliases changed', async () => {
    const now = Date.now()
    await raw.writeNode({
      ...makeNode('n1', '张三', now, { summary: '同事' }),
      aliases: ['小张']
    })
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue({
        id: 'n1',
        name: '张三',
        summary: '同事',
        modelId: 'embed-v1',
        dimension: 2
      }),
      applyRawNode,
      applyRawEdge: vi.fn(),
      listLiveIds: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
      softDeleteNode: vi.fn(),
      softDeleteEdge: vi.fn()
    }

    await new NotebookGraphIndexService(raw, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1', absentSweep: 'off' })

    expect(embedQuery).not.toHaveBeenCalled()
    expect(applyRawNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }))
    expect(applyRawNode.mock.calls[0]?.[0]).not.toHaveProperty('embedding')
  })

  it('should not embed a new node that still has no live vector', async () => {
    const now = Date.now()
    await raw.writeNode(makeNode('n1', '张三', now, { summary: '同事' }))
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue(null),
      applyRawNode,
      applyRawEdge: vi.fn(),
      listLiveIds: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
      softDeleteNode: vi.fn(),
      softDeleteEdge: vi.fn()
    }

    await new NotebookGraphIndexService(raw, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1', absentSweep: 'off' })

    expect(embedQuery).not.toHaveBeenCalled()
    expect(applyRawNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }))
    expect(applyRawNode.mock.calls[0]?.[0]).not.toHaveProperty('embedding')
  })
})
