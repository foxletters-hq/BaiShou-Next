import type { NotebookGraphNodeRow } from '../schema/knowledge'

export function requireNotebookId(notebookId: string): string {
  const id = notebookId.trim()
  if (!id) throw new Error('notebook graph requires notebookId')
  return id
}

export function serializeVector(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer)
}

/** applyRawNode 只在传入了新向量时改这三列，避免复核写回把旧向量清掉。 */
export function notebookNodeEmbeddingPatch(row: {
  embedding?: number[] | null
  modelId?: string
}): { embedding: Buffer; dimension: number; modelId: string } | Record<string, never> {
  if (!row.embedding?.length) return {}
  return {
    embedding: serializeVector(row.embedding),
    dimension: row.embedding.length,
    modelId: row.modelId ?? ''
  }
}

export function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 1
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb))
  return 1 - sim
}

export function omitNodeEmbedding(
  row: NotebookGraphNodeRow
): Omit<NotebookGraphNodeRow, 'embedding'> {
  const { embedding: _embedding, ...rest } = row
  return rest
}

/** 裸名（区分信息为空）必须排在最前，其余按区分信息字典序，查询结果才稳定。 */
export function compareDiscriminatorAsc(a: string, b: string): number {
  if (a === b) return 0
  if (a === '') return -1
  if (b === '') return 1
  return a < b ? -1 : 1
}

export function mergeNotebookAliases(
  existingRaw: string | string[] | undefined,
  extra: string[]
): string[] {
  let existing: string[] = []
  if (Array.isArray(existingRaw)) existing = existingRaw
  else if (typeof existingRaw === 'string' && existingRaw.trim()) {
    try {
      const parsed = JSON.parse(existingRaw) as unknown
      if (Array.isArray(parsed)) existing = parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      existing = []
    }
  }
  const out = new Set<string>()
  for (const a of [...existing, ...extra]) {
    const n = a.trim()
    if (n) out.add(n)
  }
  return [...out]
}
