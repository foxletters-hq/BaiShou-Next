const TEXT_LIKE_EXTS = ['.md', '.txt', '.markdown']

export type KnowledgeSourceFileKind = 'pdf' | 'url' | 'text' | 'unsupported'

export function classifyKnowledgeSourceFile(params: {
  hasRelativePath: boolean
  sourceKind: string
  ext: string
}): KnowledgeSourceFileKind {
  if (!params.hasRelativePath) return 'unsupported'
  if (params.ext === '.pdf') return 'pdf'
  const isTextLike =
    params.sourceKind === 'text' ||
    params.sourceKind === 'note' ||
    params.sourceKind === 'url' ||
    TEXT_LIKE_EXTS.includes(params.ext)
  if (!isTextLike) return 'unsupported'
  return params.sourceKind === 'url' ? 'url' : 'text'
}
