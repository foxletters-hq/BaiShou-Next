import type { ToolGraphReader, ToolGraphRagResult } from '@baishou/shared'

export type GraphRecallFn = (opts: {
  entity: string
  mode: 'network' | 'timeline'
}) => Promise<ToolGraphRagResult>

/**
 * Host-injected GraphRAG adapter for recall_relations tool.
 */
export class GraphReaderAdapter implements ToolGraphReader {
  constructor(private readonly recall: GraphRecallFn) {}

  async recallRelations(opts: {
    entity: string
    mode: 'network' | 'timeline'
  }): Promise<ToolGraphRagResult> {
    return this.recall(opts)
  }
}
