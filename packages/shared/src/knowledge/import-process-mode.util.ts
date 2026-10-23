import type { KnowledgeImportProcessMode } from '../types/settings.types'

export const KNOWLEDGE_IMPORT_PROCESS_MODES = ['vector', 'both', 'later'] as const

export function normalizeKnowledgeImportProcessMode(value: unknown): KnowledgeImportProcessMode {
  if (value === 'vector') return 'vector'
  // 旧「只抽图」在先向量再抽图的顺序下，实际就是两者都做。
  if (value === 'graph') return 'both'
  if (value === 'later' || value === 'none' || value === 'save-only') return 'later'
  return 'both'
}

export function knowledgeImportProcessModeLabel(mode: KnowledgeImportProcessMode): string {
  if (mode === 'vector') return '向量'
  if (mode === 'later') return '稍后整理'
  return '向量和图关系'
}

export function knowledgeImportProcessTargets(mode: KnowledgeImportProcessMode): {
  extract: boolean
  embed: boolean
  graph: boolean
} {
  if (mode === 'vector') return { extract: true, embed: true, graph: false }
  if (mode === 'later') return { extract: false, embed: false, graph: false }
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

/** 稍后整理：只保存文件，不入队提取 / 嵌入 / 图关系。 */
export function shouldDeferKnowledgeImportOrganize(mode: KnowledgeImportProcessMode): boolean {
  return !knowledgeImportProcessTargets(mode).extract
}
