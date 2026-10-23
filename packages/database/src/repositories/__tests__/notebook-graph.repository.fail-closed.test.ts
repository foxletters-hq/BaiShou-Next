import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { notebookGraphNodeIdForEntity } from '@baishou/shared'
import { NotebookGraphRepository } from '../notebook-graph.repository'

describe('NotebookGraphRepository fail-closed', () => {
  it('缺 notebookId 抛错', async () => {
    const repo = new NotebookGraphRepository({} as never)
    await expect(repo.getView({ vaultId: 'v1', notebookId: '' })).rejects.toThrow(/notebookId/)
    await expect(repo.searchNodes({ vaultId: 'v1', notebookId: '  ', query: 'x' })).rejects.toThrow(
      /notebookId/
    )
    await expect(repo.searchNodesByVector('v1', '', [1, 0, 0, 0], 3)).rejects.toThrow(/notebookId/)
    await expect(repo.updateNodeEmbedding('n1', 'v1', '  ', [1], 'm')).rejects.toThrow(/notebookId/)
    await expect(repo.clearNodeEmbedding('n1', 'v1', '')).rejects.toThrow(/notebookId/)
  })

  it('跨本身份不碰撞', () => {
    const a = notebookGraphNodeIdForEntity('v1', 'nb1', 'person', '小明')
    const b = notebookGraphNodeIdForEntity('v1', 'nb2', 'person', '小明')
    expect(a).not.toBe(b)
  })

  it('should always pass a SQL LIMIT to getView so unlimited is not one row', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const viewSrc = readFileSync(
      path.join(testDir, '../notebook-graph.repository.query.view.ts'),
      'utf8'
    )
    const columnsSrc = readFileSync(
      path.join(testDir, '../notebook-graph.repository.query.columns.ts'),
      'utf8'
    )
    expect(viewSrc).toContain('graphViewSqlLimit')
    expect(viewSrc).toContain('await nodeQuery.limit(queryLimit)')
    expect(viewSrc).not.toContain('queryLimit == null ? nodeQuery')
    expect(columnsSrc).toContain('NOTEBOOK_GRAPH_VIEW_NODE_COLUMNS')
    expect(columnsSrc).toContain('NOTEBOOK_GRAPH_VIEW_EDGE_COLUMNS')
    const getViewSrc = viewSrc.slice(
      viewSrc.indexOf('async getView'),
      viewSrc.indexOf('async getNeighborhood')
    )
    expect(getViewSrc).not.toContain('embedding')
    expect(getViewSrc).not.toContain('inArray(notebookGraphEdgesTable.fromId')
  })
})
