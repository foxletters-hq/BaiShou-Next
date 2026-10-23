import { logger } from '@baishou/shared'
import { registerKnowledgeExtractIpc } from './knowledge-extract.ipc'
import { registerKnowledgeGraphIpc } from './knowledge-graph.ipc'
import { registerKnowledgeNotebookIpc } from './knowledge-notebook.ipc'
import { registerKnowledgeSearchIpc } from './knowledge-search.ipc'
import { registerKnowledgeSourceIpc } from './knowledge-source.ipc'

export { getKnowledgeIngestService, resetKnowledgeIngestService } from './knowledge-ipc.context'

export function registerKnowledgeIPC(): void {
  registerKnowledgeNotebookIpc()
  registerKnowledgeSourceIpc()
  registerKnowledgeSearchIpc()
  registerKnowledgeExtractIpc()
  registerKnowledgeGraphIpc()
  logger.info('[KnowledgeIPC] handlers registered')
}
