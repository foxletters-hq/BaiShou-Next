import type {
  NotebookGraphEdgeRawRecord,
  NotebookGraphExtractStateRawRecord,
  NotebookGraphNodeRawRecord
} from '@baishou/shared'

/** JSONL writes used by knowledge extract — not the full raw manager. */
export interface NotebookGraphExtractRaw {
  getExtractState(
    notebookId: string,
    sourceId: string
  ): Promise<NotebookGraphExtractStateRawRecord | null>
  replaceSourceGraph(input: {
    notebookId: string
    sourceId: string
    nodes: NotebookGraphNodeRawRecord[]
    edges: NotebookGraphEdgeRawRecord[]
    extractState: NotebookGraphExtractStateRawRecord
  }): Promise<void>
  deleteSourceShards?(notebookId: string, sourceId: string): Promise<void>
}
