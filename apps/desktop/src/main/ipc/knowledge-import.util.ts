import {
  normalizeKnowledgeImportProcessMode,
  shouldDeferKnowledgeImportOrganize,
  type KnowledgeImportProcessMode
} from '@baishou/shared'

export function resolveKnowledgeImportDefer(rawImportProcessMode: unknown): {
  importProcessMode: KnowledgeImportProcessMode
  deferOrganize: boolean
} {
  const raw = String(rawImportProcessMode ?? '').trim()
  const importProcessMode = normalizeKnowledgeImportProcessMode(rawImportProcessMode)
  const deferOrganize =
    shouldDeferKnowledgeImportOrganize(importProcessMode) ||
    raw === 'later' ||
    raw === 'none' ||
    raw === 'save-only'
  return { importProcessMode, deferOrganize }
}
