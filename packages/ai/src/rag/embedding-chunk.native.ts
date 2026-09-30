import type { ChunkResult } from './embedding.types'

export const MAX_CHUNK_TOKENS = 1024
export const CHUNK_OVERLAP_TOKENS = 128

/** Hermes 无法加载 tiktoken WASM，按 cl100k 大约 4 chars/token 近似切片 */
const CHARS_PER_TOKEN = 4

export function splitTextIntoChunks(text: string): ChunkResult[] {
  const max = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN
  const overlap = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN

  if (text.length <= max) {
    return [{ index: 0, text }]
  }

  const chunks: ChunkResult[] = []
  let start = 0
  let index = 0
  while (start < text.length) {
    let end = start + max
    if (end > text.length) end = text.length

    chunks.push({ index, text: text.slice(start, end) })

    if (end >= text.length) break

    start = end - overlap
    if (start >= text.length) break
    index++
  }

  return chunks
}

export function normalizeEmbeddingVector(vec: number[]): number[] {
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}
