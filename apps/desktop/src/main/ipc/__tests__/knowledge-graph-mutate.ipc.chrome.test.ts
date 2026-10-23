import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const ipc = readFileSync(join(dir, '..', 'knowledge-graph.ipc.ts'), 'utf8')
const preload = readFileSync(join(dir, '../../../preload/knowledge.api.ts'), 'utf8')
const dts = readFileSync(join(dir, '../../../renderer/src/global-knowledge-api.d.ts'), 'utf8')
const mutate = readFileSync(join(dir, '../../services/notebook-graph-mutate.ts'), 'utf8')

describe('knowledge graph mutate ipc', () => {
  it('should register merge and similar handlers that call the shared notebook adapter', () => {
    expect(ipc).toContain("'knowledge:merge-graph-nodes'")
    expect(ipc).toContain("'knowledge:merge-graph-nodes-batch'")
    expect(ipc).toContain("'knowledge:list-graph-similar-pairs'")
    expect(ipc).toContain("'knowledge:dismiss-graph-similar-pair'")
    expect(ipc).toContain('mergeDesktopNotebookGraphNodes')
    expect(ipc).toContain('listDesktopNotebookSimilarPairs')
    expect(mutate).toContain('mergeNotebookGraphNodes')
    expect(mutate).toContain('collectSimilarPendingPairs')
    expect(mutate).toContain('syncDiaryGraphMergeIntoIndex')
    expect(preload).toContain('mergeGraphNodes')
    expect(preload).toContain('listGraphSimilarPairs')
    expect(dts).toContain('mergeGraphNodes(')
    expect(dts).toContain('listGraphSimilarPairs(')
  })
})
