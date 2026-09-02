import { MAX_MOUNTED_NOTEBOOKS, parseMountedNotebookIds } from './mounted-notebook.util'

export type NotebookMountCandidate = {
  id: string
  name: string
  sources: number
  chunks: number
  dimension: number | null
  mixedEmbeddings?: boolean
}

export function selectedMountDimension(opts: {
  selectedIds: string[]
  candidates: NotebookMountCandidate[]
}): number | null {
  const selected = parseMountedNotebookIds(opts.selectedIds)
  const dims = selected
    .map((id) => opts.candidates.find((row) => row.id === id)?.dimension)
    .filter((dim): dim is number => typeof dim === 'number' && dim > 0)
  return dims[0] ?? null
}

export function canToggleMountedNotebook(opts: {
  selectedIds: string[]
  candidate: NotebookMountCandidate
  candidates: NotebookMountCandidate[]
  max?: number
}): { allowed: boolean; reason?: string } {
  const selected = parseMountedNotebookIds(opts.selectedIds)
  if (selected.includes(opts.candidate.id)) {
    return { allowed: true }
  }
  const max = opts.max ?? MAX_MOUNTED_NOTEBOOKS
  if (selected.length >= max) {
    return { allowed: false, reason: `最多同时挂载 ${max} 本` }
  }
  if (opts.candidate.mixedEmbeddings) {
    return { allowed: false, reason: '这本笔记本内部向量维度不一致，请先重新嵌入' }
  }
  const currentDim = selectedMountDimension({
    selectedIds: selected,
    candidates: opts.candidates
  })
  if (
    currentDim != null &&
    opts.candidate.dimension != null &&
    opts.candidate.dimension !== currentDim
  ) {
    return {
      allowed: false,
      reason: '维度不同不能同时检索，可到知识库重新嵌入'
    }
  }
  return { allowed: true }
}

export function toggleMountedNotebook(opts: {
  selectedIds: string[]
  candidateId: string
  candidates: NotebookMountCandidate[]
  max?: number
}): { next: string[]; error?: string } {
  const selected = parseMountedNotebookIds(opts.selectedIds)
  if (selected.includes(opts.candidateId)) {
    return { next: selected.filter((id) => id !== opts.candidateId) }
  }
  const candidate = opts.candidates.find((row) => row.id === opts.candidateId)
  if (!candidate) return { next: selected, error: '找不到这本笔记本' }
  const gate = canToggleMountedNotebook({
    selectedIds: selected,
    candidate,
    candidates: opts.candidates,
    max: opts.max
  })
  if (!gate.allowed) return { next: selected, error: gate.reason }
  return { next: parseMountedNotebookIds([...selected, opts.candidateId]) }
}
