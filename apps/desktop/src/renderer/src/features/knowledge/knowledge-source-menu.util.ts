export type KnowledgeSourceMenuAction =
  | 'preview'
  | 'embed'
  | 'reembed'
  | 'reembed-vector'
  | 'reembed-graph'
  | 'delete'
  | 'cancel'
  | 'retry'
  | 'ocr'

export function knowledgeSourceNeedsOcr(source: {
  status: string
}): boolean {
  return source.status === 'needs_ocr' || source.status === 'partial'
}

export function knowledgeSourceCanCancelExtract(source: {
  status: string
  extractEngine?: string | null
}): boolean {
  const isOcrEngine = source.extractEngine === 'ocr' || source.extractEngine === 'vision'
  return (
    source.status === 'extracting' || (source.status === 'pending' && isOcrEngine)
  )
}

export function knowledgeSourceCanEmbed(source: { status: string }): boolean {
  return source.status === 'stored'
}

export function knowledgeSourceCanReembed(source: { status: string }): boolean {
  return source.status === 'ready' || source.status === 'partial'
}

export function buildKnowledgeSourceMenuActions(input: {
  status: string
  extractEngine?: string | null
  ocrRunning?: boolean
}): KnowledgeSourceMenuAction[] {
  const source = { status: input.status, extractEngine: input.extractEngine }
  const actions: KnowledgeSourceMenuAction[] = ['preview']
  if (knowledgeSourceCanEmbed(source) && !input.ocrRunning) actions.push('embed')
  if (knowledgeSourceCanReembed(source) && !input.ocrRunning) actions.push('reembed')
  if (knowledgeSourceCanCancelExtract(source) || input.ocrRunning) actions.push('cancel')
  if (knowledgeSourceNeedsOcr(source) && !input.ocrRunning) actions.push('ocr')
  if (
    (source.status === 'failed' || source.status === 'needs_ocr') &&
    !input.ocrRunning
  ) {
    actions.push('retry')
  }
  actions.push('delete')
  return actions
}
