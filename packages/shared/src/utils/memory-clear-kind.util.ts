import { RAG_VECTOR_KINDS, type RagVectorKind } from './rag-vector-kind.util'

export const MEMORY_CLEAR_VECTOR_KINDS = RAG_VECTOR_KINDS

export const MEMORY_CLEAR_KINDS = [...MEMORY_CLEAR_VECTOR_KINDS, 'life_graph'] as const

export type MemoryClearKind = (typeof MEMORY_CLEAR_KINDS)[number]

export function isMemoryClearKind(value: unknown): value is MemoryClearKind {
  return typeof value === 'string' && (MEMORY_CLEAR_KINDS as readonly string[]).includes(value)
}

export function isMemoryClearVectorKind(value: unknown): value is RagVectorKind {
  return (
    typeof value === 'string' && (MEMORY_CLEAR_VECTOR_KINDS as readonly string[]).includes(value)
  )
}

/** IPC 未传 kinds 时保持旧行为：清全部向量片段，不动人生关系图。 */
export function parseMemoryClearKinds(input: unknown): MemoryClearKind[] {
  if (input == null) return [...MEMORY_CLEAR_VECTOR_KINDS]
  if (!Array.isArray(input)) return []
  const seen = new Set<MemoryClearKind>()
  for (const item of input) {
    if (isMemoryClearKind(item)) seen.add(item)
  }
  return [...seen]
}

export function memoryClearVectorKindsOf(kinds: readonly MemoryClearKind[]): RagVectorKind[] {
  return kinds.filter(isMemoryClearVectorKind)
}

export function shouldTombstoneMemoryRecord(
  kinds: readonly MemoryClearKind[],
  record: { sourceSessionId?: string | null }
): boolean {
  const partner = kinds.includes('partner')
  const manual = kinds.includes('manual')
  if (!partner && !manual) return false
  if (partner && manual) return true
  const isManual = record.sourceSessionId == null || record.sourceSessionId === ''
  return manual ? isManual : !isManual
}
