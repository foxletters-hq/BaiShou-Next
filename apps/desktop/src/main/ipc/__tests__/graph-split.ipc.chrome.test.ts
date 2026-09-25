import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const src = [
  readFileSync(join(dir, '../graph.ipc.ts'), 'utf8'),
  readFileSync(join(dir, '../graph-mutate.ipc.ts'), 'utf8'),
  readFileSync(join(dir, '../graph-review.write.ts'), 'utf8'),
  readFileSync(join(dir, '../graph-name-candidates.ts'), 'utf8'),
  readFileSync(join(dir, '../graph-query.ipc.ts'), 'utf8')
].join('\n')
const agentSrc = readFileSync(join(dir, '../companion-stream-host.ts'), 'utf8')
const notebookReviewSrc = readFileSync(join(dir, '../../services/notebook-graph-review.ts'), 'utf8')

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  expect(from).toBeGreaterThanOrEqual(0)
  expect(to).toBeGreaterThan(from)
  return source.slice(from, to)
}

describe('graph split ipc', () => {
  it('should register the four split handlers when graph ipc boots', () => {
    expect(src).toContain("'graph:split-node'")
    expect(src).toContain("'graph:revert-node-split'")
    expect(src).toContain("'graph:list-name-candidates'")
    expect(src).toContain("'graph:list-split-edges'")
  })

  it('should sync split writes without waiting on a full orphan sweep or embed', () => {
    const split = sliceBetween(src, "'graph:split-node'", "'graph:revert-node-split'")
    expect(split).toContain('syncGraphPendingIndex')
    expect(split).toContain("absentSweep: 'off'")
    expect(split).toContain('embedMissing: false')
  })

  it('should soft-delete the split node and sync the index when reverting a split', () => {
    const from = src.indexOf("'graph:revert-node-split'")
    const to = src.indexOf("'graph:list-name-candidates'")
    expect(from).toBeGreaterThanOrEqual(0)
    expect(to).toBeGreaterThan(from)
    const revert = src.slice(from, to)
    expect(revert).toContain('revertGraphNodeSplit')
    expect(revert).toContain('syncDiaryGraphMergeIntoIndex')
    expect(revert).toContain('softDeleteNode')
    expect(revert).toContain('removedNodeId')
  })

  it('should look up same-name nodes with the multi-return helper when finding or creating', () => {
    expect(src).toContain('findNodesByNameOrAlias')
    expect(src).toContain('canRegisterAnother')
    expect(agentSrc).toContain('findNodesByNameOrAlias')
    expect(agentSrc).toContain('[0]')
  })

  it('should treat same-name as conflict only when discriminator also matches when upserting a node', () => {
    const upsert = sliceBetween(src, "'graph:upsert-node'", "'graph:upsert-edge'")
    expect(upsert).toContain('sameNameHits.find')
    expect(upsert).toContain('row.discriminator')
    expect(upsert).toContain('existing?.discriminator')
    expect(upsert).not.toContain('sameNameHits.find((row) => row.id !== currentId)')
    expect(upsert).toContain('sameNameHits.map((row) => toNameCandidate(row))')
    expect(upsert).toContain('canRegisterAnother')
  })

  it('should include discriminator on both GraphNodeRawRecord writes when rewriting a node', () => {
    const review = sliceBetween(
      src,
      'async function writeNodeReview',
      'async function writeEdgeReview'
    )
    expect(review).toContain('const record: GraphNodeRawRecord')
    expect(review).toContain('discriminator: node.discriminator')
    const upsert = sliceBetween(src, "'graph:upsert-node'", "'graph:upsert-edge'")
    expect(upsert).toContain('const record: GraphNodeRawRecord')
    expect(upsert).toContain('discriminator: existing?.discriminator')
  })

  it('should include discriminator on the notebook review record when rewriting a node', () => {
    const review = sliceBetween(
      notebookReviewSrc,
      'async function writeNodeReview',
      'async function writeEdgeReview'
    )
    expect(review).toContain('const record: NotebookGraphNodeRawRecord')
    expect(review).toContain('discriminator: node.discriminator')
  })
})
