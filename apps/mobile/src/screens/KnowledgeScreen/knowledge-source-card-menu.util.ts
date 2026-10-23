import {
  knowledgeSourceCanCancelExtract,
  knowledgeSourceCanEmbed,
  knowledgeSourceCanReembedGraph,
  knowledgeSourceCanReembedVector,
  knowledgeSourceCanRetry
} from './knowledge-screen.util'

export type KnowledgeSourceCardMenuAction =
  | 'preview-original'
  | 'preview-extracted'
  | 'embed'
  | 'cancel'
  | 'retry'
  | 'reembed-vector'
  | 'reembed-graph'
  | 'delete'

export function buildKnowledgeSourceCardMenuActions(input: {
  status: string
  extractEngine?: string | null
  ocrRunning?: boolean
}): KnowledgeSourceCardMenuAction[] {
  const source = { status: input.status, extractEngine: input.extractEngine }
  const actions: KnowledgeSourceCardMenuAction[] = ['preview-original', 'preview-extracted']
  if (knowledgeSourceCanEmbed(source.status) && !input.ocrRunning) actions.push('embed')
  if (knowledgeSourceCanCancelExtract(source) || input.ocrRunning) actions.push('cancel')
  if (knowledgeSourceCanRetry(source.status) && !input.ocrRunning) actions.push('retry')
  if (knowledgeSourceCanReembedVector(source.status) && !input.ocrRunning) {
    actions.push('reembed-vector')
  }
  if (knowledgeSourceCanReembedGraph(source.status) && !input.ocrRunning) {
    actions.push('reembed-graph')
  }
  actions.push('delete')
  return actions
}
