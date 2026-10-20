import { describe, expect, it } from 'vitest'
import { writeAlignedEmbeddings } from '../knowledge-graph-extraction.align'
import { NB_THIS, VAULT } from './knowledge-graph-extraction-align.test-helpers'

describe('writeAlignedEmbeddings', () => {
  it('should keep repository this when writing aligned embeddings', async () => {
    const written: unknown[][] = []
    class RepoLike {
      embed = {
        updateNodeEmbedding: async (...args: unknown[]) => {
          written.push(args)
        }
      }
      updateNodeEmbedding(
        id: string,
        vaultId: string,
        notebookId: string,
        embedding: number[],
        modelId: string
      ) {
        return this.embed.updateNodeEmbedding(id, vaultId, notebookId, embedding, modelId)
      }
    }
    const repo = new RepoLike()
    await writeAlignedEmbeddings(
      { repo: repo as never, llm: async () => null, align: { modelId: 'embed-v1' } },
      VAULT,
      NB_THIS,
      new Map([['n1', [1, 0]]])
    )
    expect(written).toEqual([['n1', VAULT, NB_THIS, [1, 0], 'embed-v1']])
  })
})
