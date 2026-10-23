import { describe, expect, it } from 'vitest'
import { listPendingEmbedPartLines } from '../pending-embed-part-lines.util'

describe('listPendingEmbedPartLines', () => {
  it('should list only memory-system leftover counts when parts are given', () => {
    const lines = listPendingEmbedPartLines(
      {
        diaries: 81,
        memories: 0,
        graphNodes: 2,
        knowledgeSources: 1,
        notebookGraphNodes: 4,
        total: 88
      },
      3
    )

    expect(lines.map((line) => [line.key, line.count])).toEqual([
      ['memory.pending_embed_part_diaries', 81],
      ['memory.pending_embed_part_memories', 0],
      ['memory.pending_embed_part_graph_nodes', 2],
      ['memory.pending_embed_part_graph_extract', 3]
    ])
  })
})
