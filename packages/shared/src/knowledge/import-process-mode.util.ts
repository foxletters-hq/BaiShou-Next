import type { KnowledgeImportProcessMode } from '../types/settings.types'

export const KNOWLEDGE_IMPORT_PROCESS_MODES = ['vector', 'graph', 'both'] as const

export function normalizeKnowledgeImportProcessMode(
  value: unknown
): KnowledgeImportProcessMode {
  if (value === 'vector') return 'vector'
  if (value === 'graph') return 'graph'
  return 'both'
}

export function knowledgeImportProcessModeLabel(
  mode: KnowledgeImportProcessMode
): string {
  if (mode === 'vector') return '向量'
  if (mode === 'graph') return '图关系'
  return '向量和图关系'
}

export function knowledgeImportProcessTargets(mode: KnowledgeImportProcessMode): {
  extract: boolean
  embed: boolean
  graph: boolean
} {
  if (mode === 'vector') return { extract: true, embed: true, graph: false }
  if (mode === 'graph') return { extract: true, embed: false, graph: true }
  return { extract: true, embed: true, graph: true }
}

export function knowledgeImportProcessSelectOptions(): Array<{
  value: KnowledgeImportProcessMode
  label: string
}> {
  return KNOWLEDGE_IMPORT_PROCESS_MODES.map((value) => ({
    value,
    label: knowledgeImportProcessModeLabel(value)
  }))
}
